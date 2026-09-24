import {
  ORDER_STATUSES,
  type OrderStatsCard,
  type OrderStatsResponse,
  type OrderStatus,
} from '@radeya/shared';

import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../db/client';
import type { OrderStatsInput } from './stats.schemas';

/**
 * Сводка по заказам за период.
 *
 * Считается двумя запросами с группировкой, а не перебором заказов: их десятки
 * тысяч, и тянуть их в память ради пяти чисел незачем. Первый запрос даёт
 * разбивку по точке и стадии, второй — привязанные заказы, которые в суммы
 * не входят.
 */

/** Возврат: оформленный и заявленный. Деньги по ним не выручка. */
const RETURN_STATUSES: OrderStatus[] = [
  ORDER_STATUSES.RETURNED,
  ORDER_STATUSES.RETURN_REQUESTED,
];

/** Отмена: отменённый и ожидающий отмены. Сюда же попадает «Ошибочный ввод». */
const CANCELLED_STATUSES: OrderStatus[] = [
  ORDER_STATUSES.CANCELLED,
  ORDER_STATUSES.CANCELLING,
];

/**
 * Завершённый заказ: деньги получены.
 *
 * Только «Доставлен». Самовывоз и своя доставка остаются в пути, пока их
 * не перевели в доставленные, — иначе чистая выручка считала бы заказы,
 * которые ещё лежат на складе.
 */
const DELIVERED_STATUSES: OrderStatus[] = [ORDER_STATUSES.DELIVERED];

export async function getOrderStats(input: OrderStatsInput): Promise<OrderStatsResponse> {
  const period: Prisma.OrderWhereInput = {
    ...(input.from || input.to
      ? {
          placedAt: {
            ...(input.from ? { gte: new Date(input.from) } : {}),
            ...(input.to ? { lte: new Date(input.to) } : {}),
          },
        }
      : {}),
  };

  const [points, byStatus, linked] = await Promise.all([
    prisma.salesPoint.findMany({
      select: { id: true, name: true, type: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    // Привязанные исключаются здесь: та же продажа уже посчитана на площадке.
    prisma.order.groupBy({
      by: ['salesPointId', 'status'],
      where: { ...period, linkedOrderId: null },
      _count: { _all: true },
      _sum: { totalPrice: true },
    }),
    prisma.order.groupBy({
      by: ['salesPointId'],
      where: { ...period, linkedOrderId: { not: null } },
      _count: { _all: true },
      _sum: { totalPrice: true },
    }),
  ]);

  const totals = new Map<string, Accumulator>();

  for (const point of points) totals.set(point.id, emptyAccumulator());

  for (const row of byStatus) {
    const accumulator = totals.get(row.salesPointId);

    // Точка не из справочника появиться не может — связь обязательная,
    // но группировка об этом не знает, поэтому проверяем.
    if (accumulator === undefined) continue;

    add(accumulator, row.status, row._count._all, row._sum.totalPrice);
  }

  for (const row of linked) {
    const accumulator = totals.get(row.salesPointId);

    if (accumulator === undefined) continue;

    accumulator.linkedCount += row._count._all;
    accumulator.linkedAmount = accumulator.linkedAmount.plus(row._sum.totalPrice ?? 0);
  }

  const all = emptyAccumulator();

  for (const accumulator of totals.values()) merge(all, accumulator);

  return {
    from: input.from ?? null,
    to: input.to ?? null,
    total: toCard(null, all),
    // Точки без единого заказа за период не показываем: карточка из одних
    // нулей занимает место и ничего не сообщает.
    points: points
      .map((point) => ({ point, data: totals.get(point.id)! }))
      .filter(({ data }) => data.ordersCount > 0 || data.linkedCount > 0)
      .map(({ point, data }) => toCard(point, data)),
  };
}

interface Accumulator {
  ordersCount: number;
  returnsCount: number;
  cancelledCount: number;
  netRevenue: Prisma.Decimal;
  inTransit: Prisma.Decimal;
  linkedCount: number;
  linkedAmount: Prisma.Decimal;
}

function emptyAccumulator(): Accumulator {
  return {
    ordersCount: 0,
    returnsCount: 0,
    cancelledCount: 0,
    netRevenue: new Prisma.Decimal(0),
    inTransit: new Prisma.Decimal(0),
    linkedCount: 0,
    linkedAmount: new Prisma.Decimal(0),
  };
}

/**
 * Одна группа «точка + стадия» в счётчики.
 *
 * Деньги отменённых и возвратов не попадают никуда: это не выручка. Остальное
 * делится на доставленное и всё прочее — «в пути».
 */
function add(
  accumulator: Accumulator,
  status: OrderStatus,
  count: number,
  sum: Prisma.Decimal | null,
): void {
  const amount = sum ?? new Prisma.Decimal(0);

  accumulator.ordersCount += count;

  if (RETURN_STATUSES.includes(status)) {
    accumulator.returnsCount += count;

    return;
  }

  if (CANCELLED_STATUSES.includes(status)) {
    accumulator.cancelledCount += count;

    return;
  }

  if (DELIVERED_STATUSES.includes(status)) {
    accumulator.netRevenue = accumulator.netRevenue.plus(amount);

    return;
  }

  accumulator.inTransit = accumulator.inTransit.plus(amount);
}

function merge(target: Accumulator, source: Accumulator): void {
  target.ordersCount += source.ordersCount;
  target.returnsCount += source.returnsCount;
  target.cancelledCount += source.cancelledCount;
  target.netRevenue = target.netRevenue.plus(source.netRevenue);
  target.inTransit = target.inTransit.plus(source.inTransit);
  target.linkedCount += source.linkedCount;
  target.linkedAmount = target.linkedAmount.plus(source.linkedAmount);
}

function toCard(
  salesPoint: OrderStatsCard['salesPoint'],
  data: Accumulator,
): OrderStatsCard {
  return {
    salesPoint,
    ordersCount: data.ordersCount,
    returnsCount: data.returnsCount,
    // Доля от нуля — ноль, а не NaN: делить не на что, но и показывать нечего.
    returnsShare: data.ordersCount === 0
      ? 0
      : Math.round((data.returnsCount / data.ordersCount) * 1000) / 10,
    cancelledCount: data.cancelledCount,
    totalRevenue: data.netRevenue.plus(data.inTransit).toFixed(2),
    inTransit: data.inTransit.toFixed(2),
    netRevenue: data.netRevenue.toFixed(2),
    linkedCount: data.linkedCount,
    linkedAmount: data.linkedAmount.toFixed(2),
  };
}
