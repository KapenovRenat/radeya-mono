import {
  KASPI_ORDER_CHUNK_DAYS,
  KASPI_ORDER_PAGE_SIZE,
  KASPI_ORDER_PERIOD_DAYS,
  type KaspiOrderDraft,
  type OrderListResponse,
  type OrderStatus,
  type SyncKaspiOrdersResponse,
} from '@radeya/shared';

import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../db/client';
import { env } from '../../config/env';
import { AppError } from '../../lib/errors';
import { getKaspiSalesPointId } from '../sales-points/sales-points.service';
import { isKnownState, isKnownStatus } from './kaspi-order-status';
import { fetchKaspiOrders } from './kaspi-orders.client';
import { toOrderDraft } from './kaspi-orders.mapper';
import { orderRowSelect, toOrderRow } from './order-row.mapper';
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
 * Что изменилось при записи: новый заказ или смена нашей стадии.
 * Из этого воркер пишет журнал. Сравнение — со строкой в базе до записи.
 */
export interface OrderChange {
  kind: 'created' | 'status';
  orderId: string;
  code: string;
  placedAt: Date;
  /** Когда заказ появился у нас. */
  createdAt: Date;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  totalPrice: string | null;
}

/** Границы и ход синхронизации — общее для кнопок и воркера. */
interface SyncRange {
  periodFrom: number;
  periodTo: number;
  cursor: number;
  maxChunks: number;
  /** Воркер прерывает долгий цикл: проверяется между страницами и отрезками. */
  signal?: AbortSignal;
  /**
   * Изменения после записи каждого отрезка — сразу, а не в конце: оборвётся
   * цикл на середине, и записанное уже не будет «изменением» в следующем.
   */
  onChanges?: (changes: OrderChange[]) => Promise<void>;
}

type SyncStats = Omit<SyncKaspiOrdersResponse, 'period' | 'from' | 'to'>;

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
  const periodTo = input.to ? Date.parse(input.to) : Date.now();
  const cursor = input.cursor ? Date.parse(input.cursor) : periodTo;

  if (Number.isNaN(periodTo) || Number.isNaN(cursor)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Границы периода не похожи на даты');
  }

  const periodFrom = periodTo - KASPI_ORDER_PERIOD_DAYS[input.period] * DAY_MS;

  // Изменения кнопкам не нужны — их пишет в журнал только воркер.
  const { stats } = await runKaspiOrdersSync({
    periodFrom, periodTo, cursor, maxChunks: input.maxChunks,
  });

  return {
    period: input.period,
    from: new Date(periodFrom).toISOString(),
    to: new Date(periodTo).toISOString(),
    ...stats,
  };
}

/**
 * Весь период за один вызов — для воркера. Отрезки те же, что у кнопок,
 * только без курсора: воркер не ждёт браузер между шагами.
 */
export async function syncKaspiOrdersPeriod(
  periodFrom: number,
  periodTo: number,
  options: Pick<SyncRange, 'signal' | 'onChanges'>,
): Promise<SyncStats> {
  const { stats } = await runKaspiOrdersSync({
    periodFrom, periodTo, cursor: periodTo, maxChunks: Number.MAX_SAFE_INTEGER, ...options,
  });

  return stats;
}

async function runKaspiOrdersSync(range: SyncRange): Promise<{ stats: SyncStats }> {
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
  const { periodFrom, periodTo, cursor, signal } = range;
  const chunksTotal = Math.max(1, Math.ceil((periodTo - periodFrom) / chunkWidth));

  const warehouses = await loadWarehouses();
  const kaspiSalesPointId = await getKaspiSalesPointId();
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

  while (end > periodFrom && chunksHandled < range.maxChunks) {
    // Границы не пересекаются: конец отрезка на миллисекунду меньше начала
    // следующего, иначе заказ ровно на стыке приедет дважды.
    const start = Math.max(periodFrom, end - chunkWidth + 1);
    const parsed: Parsed[] = [];

    let page = 0;

    for (;;) {
      signal?.throwIfAborted();

      const result = await fetchKaspiOrders({
        token, from: start, to: end, page, pageSize: KASPI_ORDER_PAGE_SIZE,
      });

      pages += 1;
      ordersSeen += result.orders.length;

      for (const raw of result.orders) {
        const draft = toOrderDraft(raw);

        // Без номера или даты оформления заказ не сохранить: по номеру его ищут
        // и обновляют, по дате считают выручку. Подставлять «сейчас» нельзя —
        // заказ уедет не в тот день.
        if (draft === null || draft.placedAt === '') {
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

    const saved = await saveOrders(parsed, warehouses, unknownWarehouses, kaspiSalesPointId);

    created += saved.created;
    updated += saved.updated;
    skipped += saved.foreign;

    if (range.onChanges && saved.changes.length > 0) await range.onChanges(saved.changes);

    end = start - 1;
    chunksHandled += 1;

    if (end > periodFrom) await pause();
  }

  const done = end <= periodFrom;

  const stats: SyncStats = {
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

  return { stats };
}

/**
 * Страница заказов из нашей базы.
 *
 * Свежие сверху: заказы смотрят с конца, и вчерашний нужен чаще прошлогоднего.
 * `code` вторым ключом — у заказов, созданных в одну миллисекунду, порядок
 * между запросами иначе не определён, и один заказ мог бы попасть на две
 * страницы, а другой ни на одну.
 *
 * Наружу идёт узкий набор полей: адрес покупателя — персональные данные,
 * и в списке ему делать нечего. Полный заказ отдаёт `getOrderDetails`.
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
        placedAt: {
          ...(input.from ? { gte: new Date(input.from) } : {}),
          ...(input.to ? { lte: new Date(input.to) } : {}),
        },
      });
    }

    // Пустой список — «все», а не «ни одного»: иначе снятие всех галок
    // в фильтре показывало бы пустую таблицу вместо полного реестра.
    if (input.salesPointId && input.salesPointId.length > 0) {
      conditions.push({ salesPointId: { in: input.salesPointId } });
    }

    if (input.sellerId && input.sellerId.length > 0) {
      conditions.push({ sellerId: { in: input.sellerId } });
    }

    // Фильтры по справочникам устроены одинаково, поэтому перечислены списком:
    // четыре одинаковых if подряд только просят опечатку в пятом.
    const byDictionary: [keyof OrderListInput, keyof Prisma.OrderWhereInput][] = [
      ['deliveryStatusId', 'deliveryStatusId'],
      ['paymentMethodId', 'paymentMethodId'],
      ['shipmentOriginId', 'shipmentOriginId'],
      ['customerSourceId', 'customerSourceId'],
    ];

    for (const [field, column] of byDictionary) {
      const ids = input[field];

      if (Array.isArray(ids) && ids.length > 0) {
        conditions.push({ [column]: { in: ids } } as Prisma.OrderWhereInput);
      }
    }

    const where: Prisma.OrderWhereInput = { AND: conditions };

    const total = await tx.order.count({ where });
    const totalPages = Math.ceil(total / input.pageSize);
    const page = Math.min(input.page, Math.max(1, totalPages));

    const rows = await tx.order.findMany({
      where,
      select: orderRowSelect,
      orderBy: [{ placedAt: 'desc' }, { code: 'asc' }],
      skip: (page - 1) * input.pageSize,
      take: input.pageSize,
    });

    return {
      items: rows.map(toOrderRow),
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
  kaspiSalesPointId: string,
): Promise<{ created: number; updated: number; foreign: number; changes: OrderChange[] }> {
  let created = 0;
  let updated = 0;
  let foreign = 0;
  const changes: OrderChange[] = [];

  for (let from = 0; from < parsed.length; from += WRITE_BATCH) {
    const batch = parsed.slice(from, from + WRITE_BATCH);

    // Узнаём заранее, что уже лежит в базе: upsert сам этого не скажет,
    // а «создано» и «обновлено» — разные новости для человека. Заодно видим
    // точку продаж — по ней отсеиваются чужие заказы, и стадию — по ней
    // видно, что заказ сменил статус.
    const existing = await prisma.order.findMany({
      where: { code: { in: batch.map((item) => item.draft.code) } },
      select: { code: true, salesPointId: true, status: true },
    });
    const known = new Map(existing.map((row) => [row.code, row.salesPointId]));
    const statusBefore = new Map(existing.map((row) => [row.code, row.status]));

    // Заказ с тем же номером, но не от Kaspi, синхронизация не трогает.
    // Номера офлайн-заказов начинаются с букв и с цифровыми номерами площадки
    // совпасть не могут, но пояс и подтяжки тут дешевле разбирательства:
    // затёртый офлайн-заказ восстанавливать нечем.
    const writable = batch.filter((item) => {
      const owner = known.get(item.draft.code);

      if (owner !== undefined && owner !== kaspiSalesPointId) {
        foreign += 1;

        return false;
      }

      return true;
    });

    const rows = await prisma.$transaction(writable.map((item) => {
      const warehouseId = readWarehouseId(item.draft, warehouses, unknownWarehouses);
      const fields = toShopApiFields(item.draft, warehouseId, item.raw);

      return prisma.order.upsert({
        where: { code: item.draft.code },
        create: { code: item.draft.code, salesPointId: kaspiSalesPointId, ...fields },
        // Обновляются только поля Shop API. Кабинетные в набор не входят
        // намеренно: синхронизация по токену не должна затирать их пустотой —
        // их заполняет отдельный проход. Точки продаж и продавца здесь тоже
        // нет: у заказа площадки они не меняются.
        update: fields,
        select: { id: true, code: true, status: true, placedAt: true, createdAt: true,
          totalPrice: true },
      });
    }));

    for (const row of rows) {
      const isNew = !known.has(row.code);
      const before = statusBefore.get(row.code) ?? null;

      if (isNew) created += 1;
      else updated += 1;

      if (isNew || before !== row.status) {
        changes.push({
          kind: isNew ? 'created' : 'status',
          orderId: row.id,
          code: row.code,
          placedAt: row.placedAt,
          createdAt: row.createdAt,
          fromStatus: isNew ? null : before,
          toStatus: row.status,
          totalPrice: row.totalPrice?.toFixed(2) ?? null,
        });
      }
    }
  }

  return { created, updated, foreign, changes };
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

    placedAt: new Date(draft.placedAt),
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
