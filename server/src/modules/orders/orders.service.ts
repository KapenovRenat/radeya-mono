import {
  KASPI_ORDER_CHUNK_DAYS,
  KASPI_ORDER_PAGE_SIZE,
  KASPI_ORDER_PERIOD_DAYS,
  type KaspiOrderDraft,
  type OrderListResponse,
  type SyncKaspiOrdersResponse,
} from '@radeya/shared';

import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../db/client';
import { env } from '../../config/env';
import { AppError } from '../../lib/errors';
import { isKnownState, isKnownStatus } from './kaspi-order-status';
import { fetchKaspiOrders } from './kaspi-orders.client';
import { toOrderDraft } from './kaspi-orders.mapper';
import type { OrderListInput, SyncOrdersInput } from './orders.schemas';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Пауза между запросами: Kaspi не любит, когда в него стреляют без перерыва. */
const REQUEST_PAUSE_MS = 200;

/** Записываем пачками: транзакция на тысячу заказов держит соединение слишком долго. */
const WRITE_BATCH = 100;

/** Заказ вместе с сырым ответом: сырое уходит в `raw`, разобранное — в колонки. */
interface Parsed {
  draft: KaspiOrderDraft;
  raw: unknown;
}

/**
 * Шаг синхронизации заказов Kaspi.
 *
 * Период идёт **от свежих к старым** трёхдневными отрезками: Kaspi отдаёт около
 * 10 000 позиций на диапазон, и год одним запросом теряет хвост. За вызов
 * обрабатывается `maxChunks` отрезков, дальше возвращается курсор — два года
 * это 244 отрезка, и в один запрос они не укладываются ни по времени,
 * ни по терпению браузера.
 *
 * Правый край периода (`to`) задаёт клиент и повторяет его на каждом шаге.
 * Без этого якоря «два года назад» на каждом вызове означало бы чуть другую
 * дату, окно ползло бы за временем, и последний отрезок не сходился.
 *
 * Повторный прогон безопасен: заказы пишутся по номеру, существующие обновляются.
 */
export async function syncKaspiOrders(input: SyncOrdersInput): Promise<SyncKaspiOrdersResponse> {
  const token = env.KASPI_API_TOKEN;

  if (!token) {
    throw new AppError(
      503,
      'KASPI_TOKEN_MISSING',
      'Не задан KASPI_API_TOKEN в .env — синхронизация невозможна',
    );
  }

  const startedAt = Date.now();
  const chunkWidth = KASPI_ORDER_CHUNK_DAYS * DAY_MS;

  const periodTo = input.to ? Date.parse(input.to) : startedAt;
  const cursor = input.cursor ? Date.parse(input.cursor) : periodTo;

  if (Number.isNaN(periodTo) || Number.isNaN(cursor)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Границы периода не похожи на даты');
  }

  const periodFrom = periodTo - KASPI_ORDER_PERIOD_DAYS[input.period] * DAY_MS;
  const chunksTotal = Math.max(1, Math.ceil((periodTo - periodFrom) / chunkWidth));

  const warehouses = await loadWarehouses();
  const unknownValues = new Set<string>();
  const unknownWarehouses = new Set<string>();

  let end = Math.min(cursor, periodTo);
  let chunksHandled = 0;
  let pages = 0;
  let ordersSeen = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let withProblems = 0;

  while (end > periodFrom && chunksHandled < input.maxChunks) {
    // Границы не пересекаются: конец отрезка на миллисекунду меньше начала
    // следующего, иначе заказ ровно на стыке приедет дважды.
    const start = Math.max(periodFrom, end - chunkWidth + 1);
    const parsed: Parsed[] = [];

    let page = 0;

    for (;;) {
      const result = await fetchKaspiOrders({
        token, from: start, to: end, page, pageSize: KASPI_ORDER_PAGE_SIZE,
      });

      pages += 1;
      ordersSeen += result.orders.length;

      for (const raw of result.orders) {
        const draft = toOrderDraft(raw);

        // Без номера или даты создания заказ не сохранить: по номеру его ищут
        // и обновляют, по дате считают выручку. Подставлять «сейчас» нельзя —
        // заказ уедет не в тот день.
        if (draft === null || draft.createdAtKaspi === '') {
          skipped += 1;
          continue;
        }

        if (draft.problems.length > 0) withProblems += 1;
        if (draft.kaspiStatus !== '' && !isKnownStatus(draft.kaspiStatus)) {
          unknownValues.add('status: ' + draft.kaspiStatus);
        }
        if (draft.kaspiState !== null && !isKnownState(draft.kaspiState)) {
          unknownValues.add('state: ' + draft.kaspiState);
        }

        parsed.push({ draft, raw });
      }

      // Неполная страница — значит последняя. Так обход не зависит от meta,
      // которую Kaspi может не прислать.
      if (result.orders.length < KASPI_ORDER_PAGE_SIZE) break;

      page += 1;
      await pause();
    }

    const saved = await saveOrders(parsed, warehouses, unknownWarehouses);

    created += saved.created;
    updated += saved.updated;

    end = start - 1;
    chunksHandled += 1;

    if (end > periodFrom) await pause();
  }

  const done = end <= periodFrom;

  return {
    period: input.period,
    from: new Date(periodFrom).toISOString(),
    to: new Date(periodTo).toISOString(),
    done,
    nextCursor: done ? null : new Date(end).toISOString(),
    chunksTotal,
    chunksDone: Math.min(chunksTotal, Math.ceil((periodTo - end) / chunkWidth)),
    pages,
    ordersSeen,
    created,
    updated,
    skipped,
    withProblems,
    unknownValues: [...unknownValues].sort(),
    unknownWarehouses: [...unknownWarehouses].sort(),
    tookMs: Date.now() - startedAt,
  };
}

/**
 * Страница заказов из нашей базы.
 *
 * Свежие сверху: заказы смотрят с конца, и вчерашний нужен чаще прошлогоднего.
 * `code` вторым ключом — у заказов, созданных в одну миллисекунду, порядок
 * между запросами иначе не определён, и один заказ мог бы попасть на две
 * страницы, а другой ни на одну.
 *
 * Наружу идёт узкий набор полей: телефон и адрес покупателя — персональные
 * данные, и в списке им делать нечего. Понадобятся — отдаст карточка заказа.
 */
export async function listOrders(input: OrderListInput): Promise<OrderListResponse> {
  return prisma.$transaction(async (tx) => {
    // contains использует LIKE: пользовательские % и _ должны остаться символами.
    const search = input.search
      ? input.search.replace(/[\\%_]/g, (char) => '\\' + char)
      : null;
    const conditions: Prisma.OrderWhereInput[] = [];

    if (search) conditions.push({ code: { contains: search, mode: 'insensitive' } });

    // Границы включительные: человек, выбравший «с 1 по 30», ждёт оба края
    // внутри. Момент считает клиент — только он знает свой часовой пояс.
    if (input.from || input.to) {
      conditions.push({
        createdAtKaspi: {
          ...(input.from ? { gte: new Date(input.from) } : {}),
          ...(input.to ? { lte: new Date(input.to) } : {}),
        },
      });
    }

    const where: Prisma.OrderWhereInput = { AND: conditions };

    const total = await tx.order.count({ where });
    const totalPages = Math.ceil(total / input.pageSize);
    const page = Math.min(input.page, Math.max(1, totalPages));

    const rows = await tx.order.findMany({
      where,
      select: {
        id: true, code: true, status: true, deliveryType: true, kaspiStatus: true,
        createdAtKaspi: true, plannedDeliveryAt: true, totalPrice: true,
        customerName: true, customerFirstName: true, customerLastName: true,
        customerPhone: true, deliveryTown: true, preOrder: true,
        warehouse: { select: { code: true, name: true } },
        _count: { select: { entries: true } },
      },
      orderBy: [{ createdAtKaspi: 'desc' }, { code: 'asc' }],
      skip: (page - 1) * input.pageSize,
      take: input.pageSize,
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        code: row.code,
        status: row.status,
        deliveryType: row.deliveryType,
        kaspiStatus: row.kaspiStatus,
        createdAtKaspi: row.createdAtKaspi.toISOString(),
        plannedDeliveryAt: row.plannedDeliveryAt?.toISOString() ?? null,
        // Строкой, а не числом: number на цене теряет тиын.
        totalPrice: row.totalPrice.toFixed(2),
        customerName: row.customerName,
        customerFirstName: row.customerFirstName,
        customerLastName: row.customerLastName,
        customerPhone: row.customerPhone,
        deliveryTown: row.deliveryTown,
        preOrder: row.preOrder,
        warehouse: row.warehouse,
        entriesCount: row._count.entries,
      })),
      total, page, pageSize: input.pageSize, totalPages,
    };
    // Счётчик и страница читаются в одном снимке: иначе параллельная
    // синхронизация сдвинет строки между count и findMany.
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

/** Справочник складов по идентификатору Kaspi. Читается один раз на вызов. */
async function loadWarehouses(): Promise<Map<string, string>> {
  const rows = await prisma.warehouse.findMany({ select: { id: true, kaspiStoreId: true } });

  return new Map(rows.map((row) => [row.kaspiStoreId, row.id]));
}

async function saveOrders(
  parsed: Parsed[],
  warehouses: Map<string, string>,
  unknownWarehouses: Set<string>,
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (let from = 0; from < parsed.length; from += WRITE_BATCH) {
    const batch = parsed.slice(from, from + WRITE_BATCH);

    // Узнаём заранее, что уже лежит в базе: upsert сам этого не скажет,
    // а «создано» и «обновлено» — разные новости для человека.
    const existing = await prisma.order.findMany({
      where: { code: { in: batch.map((item) => item.draft.code) } },
      select: { code: true },
    });
    const known = new Set(existing.map((row) => row.code));

    await prisma.$transaction(batch.map((item) => {
      const warehouseId = readWarehouseId(item.draft, warehouses, unknownWarehouses);
      const fields = toShopApiFields(item.draft, warehouseId, item.raw);

      return prisma.order.upsert({
        where: { code: item.draft.code },
        create: { code: item.draft.code, ...fields },
        // Обновляются только поля Shop API. Кабинетные в набор не входят
        // намеренно: синхронизация по токену не должна затирать их пустотой —
        // их заполняет отдельный проход.
        update: fields,
      });
    }));

    for (const item of batch) {
      if (known.has(item.draft.code)) updated += 1;
      else created += 1;
    }
  }

  return { created, updated };
}

function readWarehouseId(
  draft: KaspiOrderDraft,
  warehouses: Map<string, string>,
  unknownWarehouses: Set<string>,
): string | null {
  if (!draft.kaspiPickupPointId) return null;

  const id = warehouses.get(draft.kaspiPickupPointId);

  // Склад, которого нет в справочнике, не выдумываем: заказ сохранится без
  // связи, а код останется строкой — свяжем, когда склад заведут.
  if (id === undefined) {
    unknownWarehouses.add(draft.kaspiPickupPointId);

    return null;
  }

  return id;
}

/** Поля Shop API. Кабинетные сюда не попадают ни при создании, ни при обновлении. */
function toShopApiFields(draft: KaspiOrderDraft, warehouseId: string | null, raw: unknown) {
  return {
    kaspiId: draft.kaspiId,
    status: draft.status,
    deliveryType: draft.deliveryType,
    kaspiStatus: draft.kaspiStatus,
    kaspiState: draft.kaspiState,
    cancellationReason: draft.cancellationReason,

    createdAtKaspi: new Date(draft.createdAtKaspi),
    approvedByBankAt: toDate(draft.approvedByBankAt),
    completedAt: toDate(draft.completedAt),
    courierTransmissionAt: toDate(draft.courierTransmissionAt),
    courierTransmissionPlannedAt: toDate(draft.courierTransmissionPlannedAt),
    plannedDeliveryAt: toDate(draft.plannedDeliveryAt),

    totalPrice: draft.totalPrice,
    deliveryCost: draft.deliveryCost,
    deliveryCostForSeller: draft.deliveryCostForSeller,
    paymentMode: draft.paymentMode,
    creditTerm: draft.creditTerm,
    signatureRequired: draft.signatureRequired,

    preOrder: draft.preOrder,
    assembled: draft.assembled,
    isKaspiDelivery: draft.isKaspiDelivery,
    isExpress: draft.isExpress,
    returnedToWarehouse: draft.returnedToWarehouse,
    deliveryMode: draft.deliveryMode,
    waybillNumber: draft.waybillNumber,
    firstMileCourier: draft.firstMileCourier,

    kaspiCustomerId: draft.kaspiCustomerId,
    customerName: draft.customerName,
    customerFirstName: draft.customerFirstName,
    customerLastName: draft.customerLastName,
    customerPhone: draft.customerPhone,

    deliveryTown: draft.deliveryTown,
    deliveryDistrict: draft.deliveryDistrict,
    deliveryStreetName: draft.deliveryStreetName,
    deliveryStreetNumber: draft.deliveryStreetNumber,
    deliveryBuilding: draft.deliveryBuilding,
    deliveryApartment: draft.deliveryApartment,
    deliveryFloor: draft.deliveryFloor,
    deliveryEntrance: draft.deliveryEntrance,
    deliveryIntercom: draft.deliveryIntercom,
    deliveryComment: draft.deliveryComment,
    deliveryIsPrivateHouse: draft.deliveryIsPrivateHouse,
    deliveryFormattedAddress: draft.deliveryFormattedAddress,
    deliveryLatitude: draft.deliveryLatitude,
    deliveryLongitude: draft.deliveryLongitude,

    warehouseId,
    kaspiPickupPointId: draft.kaspiPickupPointId,
    originCityId: draft.originCityId,
    originCityName: draft.originCityName,
    originFormattedAddress: draft.originFormattedAddress,

    // Ответ Kaspi целиком: формат недокументирован и меняется, а потерять
    // поле, которое понадобится через полгода, дороже, чем хранить json.
    raw: (raw ?? undefined) as Prisma.InputJsonValue | undefined,
  };
}

function toDate(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

function pause(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, REQUEST_PAUSE_MS));
}
