import { ORDER_FINAL_STATUSES, SALES_POINT_TYPES, type OrderStatus } from '@radeya/shared';

import { prisma } from '../../db/client';
import type { Prisma } from '../../generated/prisma/client';
import { AppError, NotFoundError } from '../../lib/errors';
import { fetchCabinetOrderDetail } from '../kaspi-cabinet/cabinet-orders.client';
import { withCabinetSession } from '../kaspi-cabinet/cabinet-session.service';

/**
 * Поля заказа, которых нет в Shop API, — из кабинета Kaspi. Пока это
 * «Планируемая дата прибытия» (`plannedPointDeliveryAt`); ответ кабинета
 * целиком ложится в `rawCabinet`.
 *
 * Один запрос в кабинет на заказ, поэтому спрашиваем не всех:
 * - только активные заказы Kaspi — закрытым дата уже не нужна;
 * - новые сразу, остальные раз в час — дату могут поменять кнопкой «Изменить».
 * Частые запросы к кабинету — путь к блокировке входа.
 */

/** Как часто перечитывать дату у активного заказа. */
export const CABINET_REFRESH_MS = 60 * 60_000;

/** Сколько заказов спрашивать за раз — шаг кнопки или цикл воркера. */
export const CABINET_BATCH_SIZE = 20;

/** Пауза между запросами к кабинету. */
const CABINET_PAUSE_MS = 300;

export interface CabinetRefreshResult {
  order: { id: string; code: string; placedAt: Date; createdAt: Date };
  before: Date | null;
  after: Date | null;
  /** Кабинет знает этот заказ. false — дата не тронута. */
  found: boolean;
}

/** Условие «пора спросить кабинет» — для выборки пачки и для окна заказа. */
function cabinetDueWhere(now: Date): Prisma.OrderWhereInput {
  return {
    salesPoint: { type: SALES_POINT_TYPES.KASPI },
    status: { notIn: ORDER_FINAL_STATUSES },
    OR: [
      { cabinetSyncedAt: null },
      { cabinetSyncedAt: { lt: new Date(now.getTime() - CABINET_REFRESH_MS) } },
    ],
  };
}

export function isCabinetRefreshDue(
  order: { status: OrderStatus; salesPointType: string; cabinetSyncedAt: Date | null },
  now = Date.now(),
): boolean {
  return order.salesPointType === SALES_POINT_TYPES.KASPI
    && !ORDER_FINAL_STATUSES.includes(order.status)
    && (order.cabinetSyncedAt === null || now - order.cabinetSyncedAt.getTime() > CABINET_REFRESH_MS);
}

/**
 * Один заказ: спросить кабинет и записать. Время опроса ставится всегда —
 * и когда кабинет заказа не знает: иначе такой заказ спрашивали бы каждый раз.
 */
export async function refreshOrderCabinet(orderId: string): Promise<CabinetRefreshResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, code: true, placedAt: true, createdAt: true, plannedPointDeliveryAt: true,
      salesPoint: { select: { type: true } } },
  });

  if (!order) throw new NotFoundError('Заказ не найден');

  if (order.salesPoint.type !== SALES_POINT_TYPES.KASPI) {
    throw new AppError(400, 'CABINET_NOT_AVAILABLE', 'Это не заказ Kaspi — в кабинете его нет');
  }

  const detail = await withCabinetSession((cookie) => fetchCabinetOrderDetail(order.code, cookie));

  await prisma.order.update({
    where: { id: order.id },
    data: {
      cabinetSyncedAt: new Date(),
      ...(detail === null ? {} : {
        plannedPointDeliveryAt: detail.plannedPointDeliveryAt,
        rawCabinet: detail.raw as Prisma.InputJsonValue,
      }),
    },
  });

  return {
    order: { id: order.id, code: order.code, placedAt: order.placedAt, createdAt: order.createdAt },
    before: order.plannedPointDeliveryAt,
    after: detail === null ? order.plannedPointDeliveryAt : detail.plannedPointDeliveryAt,
    found: detail !== null,
  };
}

export interface CabinetBatchResult {
  processed: number;
  changed: number;
  failed: number;
  remaining: number;
}

/**
 * Пачка заказов, которым пора спросить кабинет. Новые — первыми.
 *
 * Сбой одного заказа (кабинет ответил ошибкой про него) — заказ отмечается
 * опрошенным, повтор через час, пачка идёт дальше. Сбой входа, сессии или
 * сети пачку останавливает и уходит наружу: остальные упали бы так же,
 * и двадцать одинаковых ошибок — это двадцать лишних запросов к кабинету.
 */
export async function refreshDueOrdersCabinet(options: {
  signal?: AbortSignal;
  onResult?: (result: CabinetRefreshResult) => Promise<void>;
  onOrderFailed?: (order: CabinetRefreshResult['order'], error: AppError) => Promise<void>;
}): Promise<CabinetBatchResult> {
  const now = new Date();
  const orders = await prisma.order.findMany({
    where: cabinetDueWhere(now),
    select: { id: true, code: true, placedAt: true, createdAt: true },
    orderBy: [{ cabinetSyncedAt: { sort: 'asc', nulls: 'first' } }, { placedAt: 'desc' }],
    take: CABINET_BATCH_SIZE,
  });

  let processed = 0;
  let changed = 0;
  let failed = 0;

  for (const order of orders) {
    options.signal?.throwIfAborted();

    try {
      const result = await refreshOrderCabinet(order.id);

      processed += 1;
      if (result.found && result.before?.getTime() !== result.after?.getTime()) changed += 1;
      await options.onResult?.(result);
    } catch (error) {
      if (!isOrderLevelError(error)) throw error;

      failed += 1;
      processed += 1;
      await prisma.order.update({ where: { id: order.id }, data: { cabinetSyncedAt: new Date() } });
      await options.onOrderFailed?.(order, error);
    }

    await pause(CABINET_PAUSE_MS);
  }

  const remaining = await prisma.order.count({ where: cabinetDueWhere(new Date()) });

  return { processed, changed, failed, remaining };
}

/**
 * Ошибка про конкретный заказ: кабинет ответил, но ответ про этот заказ плохой.
 * Всё остальное — вход, сессия, сеть, настройки — касается всех заказов разом.
 */
function isOrderLevelError(error: unknown): error is AppError {
  return error instanceof AppError
    && (error.code === 'KASPI_GRAPHQL_ERROR' || error.code === 'KASPI_BAD_RESPONSE');
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
