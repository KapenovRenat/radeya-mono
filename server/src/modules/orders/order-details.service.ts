import {
  SALES_POINT_TYPES,
  variantDisplayName,
  type OrderDetailsDto,
  type OrderEntryDto,
  type SyncOrderEntriesResponse,
} from '@radeya/shared';

import { env } from '../../config/env';
import { prisma } from '../../db/client';
import { AppError, NotFoundError } from '../../lib/errors';
import type { Prisma } from '../../generated/prisma/client';
import { normalizeName } from '../dictionaries/dictionaries.service';
import { previewImageUrl } from '../products/catalog.mapper';
import { fetchKaspiOrderEntries } from './kaspi-orders.client';
import { toEntryDraft, type KaspiEntryDraft } from './kaspi-order-entries.mapper';
import { orderRowSelect, toOrderRow } from './order-row.mapper';

/**
 * Заказ целиком для окна заказа и загрузка его состава с площадки.
 *
 * Состав заказов Kaspi в общий синк не входит: это запрос на каждый заказ,
 * и 4800 заказов — минут пятнадцать работы. Поэтому состав тянется, когда
 * заказ открыли впервые, и остаётся в базе: второй раз окно открывается
 * без запроса к Kaspi.
 */

/**
 * Номер позиции-заглушки: Kaspi ответил, что позиций нет. Без неё такой заказ
 * тянули бы при каждом открытии — «пусто» и «ещё не загружали» были бы неотличимы.
 * Раздел 3.2 интеграции.
 */
const EMPTY_ENTRIES_STUB = -1;

const detailsSelect = {
  ...orderRowSelect,
  kaspiId: true, kaspiState: true, cancellationReason: true,
  approvedByBankAt: true, completedAt: true,
  courierTransmissionPlannedAt: true, courierTransmissionAt: true,
  deliveryCost: true, paymentMode: true, creditTerm: true,
  deliveryMode: true, isKaspiDelivery: true, isExpress: true, waybillNumber: true,
  deliveryFormattedAddress: true, deliveryComment: true,
  originCityName: true, kaspiPickupPointId: true,
  entries: {
    select: {
      id: true, entryNumber: true, sku: true, offerName: true, quantity: true,
      basePrice: true, totalPrice: true, categoryTitle: true, note: true,
      variant: {
        select: {
          id: true, sku: true, kaspiImages: true, kaspiMasterTitle: true,
          product: { select: { name: true } },
        },
      },
    },
    orderBy: { entryNumber: 'asc' },
  },
} as const satisfies Prisma.OrderSelect;

type DetailsRecord = Prisma.OrderGetPayload<{ select: typeof detailsSelect }>;

export async function getOrderDetails(id: string): Promise<OrderDetailsDto> {
  const row = await prisma.order.findUnique({ where: { id }, select: detailsSelect });

  if (!row) throw new NotFoundError('Заказ не найден');

  return toDetails(row);
}

/**
 * Загрузка состава заказа Kaspi.
 *
 * Если состав уже есть — Kaspi не трогаем и отдаём заказ как есть: окно
 * открывается готовым. Повторный или параллельный вызов безопасен: позиции
 * пишутся с пропуском уже существующих пар «заказ + номер позиции».
 */
export async function syncOrderEntries(id: string): Promise<SyncOrderEntriesResponse> {
  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, kaspiId: true, salesPoint: { select: { type: true } },
      _count: { select: { entries: true } } },
  });

  if (!order) throw new NotFoundError('Заказ не найден');

  if (order._count.entries > 0) return { created: 0, order: await getOrderDetails(id) };

  if (order.salesPoint.type !== SALES_POINT_TYPES.KASPI || order.kaspiId === null) {
    throw new AppError(400, 'ENTRIES_NOT_AVAILABLE',
      'Состав этого заказа с площадки не загружается: он не из Kaspi');
  }

  const token = env.KASPI_API_TOKEN;

  if (!token) {
    throw new AppError(503, 'KASPI_TOKEN_MISSING',
      'Не задан KASPI_API_TOKEN в .env — состав заказа загрузить невозможно');
  }

  const drafts = (await fetchKaspiOrderEntries(token, order.kaspiId))
    .map(toEntryDraft)
    .filter((draft): draft is KaspiEntryDraft => draft !== null);

  const variants = await findVariantsBySku(drafts.map((draft) => draft.sku));

  const data: Prisma.OrderEntryCreateManyInput[] = drafts.length === 0
    ? [{ orderId: order.id, entryNumber: EMPTY_ENTRIES_STUB, quantity: 0 }]
    : drafts.map((draft) => ({
      orderId: order.id,
      entryNumber: draft.entryNumber,
      kaspiEntryId: draft.kaspiEntryId,
      sku: draft.sku,
      variantId: draft.sku === null ? null : variants.get(normalizeName(draft.sku)) ?? null,
      offerName: draft.offerName,
      kaspiProductCode: draft.kaspiProductCode,
      quantity: draft.quantity,
      basePrice: draft.basePrice,
      totalPrice: draft.totalPrice,
      deliveryCost: draft.deliveryCost,
      categoryCode: draft.categoryCode,
      categoryTitle: draft.categoryTitle,
    }));

  // skipDuplicates: окно могли открыть в двух вкладках разом — вторая запись
  // упрётся в @@unique([orderId, entryNumber]) и просто пропустится.
  const { count } = await prisma.orderEntry.createMany({ data, skipDuplicates: true });

  return { created: drafts.length === 0 ? 0 : count, order: await getOrderDetails(id) };
}

/**
 * Товары каталога по артикулам позиций, без учёта регистра — как в импортах
 * МойСклада: в заказе `zkz090`, у нас `ZKZ090`.
 */
async function findVariantsBySku(skus: (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(skus.filter((sku): sku is string => sku !== null))];

  if (wanted.length === 0) return new Map();

  const rows = await prisma.variant.findMany({
    where: { OR: wanted.map((sku) => ({ sku: { equals: sku, mode: 'insensitive' as const } })) },
    select: { id: true, sku: true },
  });

  return new Map(rows.map((row) => [normalizeName(row.sku), row.id]));
}

function toDetails(row: DetailsRecord): OrderDetailsDto {
  const iso = (value: Date | null) => value?.toISOString() ?? null;

  return {
    ...toOrderRow(row),
    kaspiState: row.kaspiState,
    cancellationReason: row.cancellationReason,
    approvedByBankAt: iso(row.approvedByBankAt),
    completedAt: iso(row.completedAt),
    courierTransmissionPlannedAt: iso(row.courierTransmissionPlannedAt),
    courierTransmissionAt: iso(row.courierTransmissionAt),
    deliveryCost: row.deliveryCost?.toFixed(2) ?? null,
    paymentMode: row.paymentMode,
    creditTerm: row.creditTerm,
    deliveryMode: row.deliveryMode,
    isKaspiDelivery: row.isKaspiDelivery,
    isExpress: row.isExpress,
    waybillNumber: row.waybillNumber,
    deliveryAddress: row.deliveryFormattedAddress,
    deliveryComment: row.deliveryComment,
    originCityName: row.originCityName,
    kaspiPickupPointId: row.kaspiPickupPointId,
    // Заглушка — служебная строка, в состав заказа она не входит.
    entries: row.entries.filter((entry) => entry.entryNumber !== EMPTY_ENTRIES_STUB).map(toEntry),
    entriesLoaded: row.entries.length > 0,
    canLoadEntries: row.salesPoint.type === SALES_POINT_TYPES.KASPI && row.kaspiId !== null,
  };
}

function toEntry(entry: DetailsRecord['entries'][number]): OrderEntryDto {
  return {
    id: entry.id,
    entryNumber: entry.entryNumber,
    sku: entry.sku,
    offerName: entry.offerName,
    quantity: entry.quantity,
    basePrice: entry.basePrice?.toFixed(2) ?? null,
    totalPrice: entry.totalPrice?.toFixed(2) ?? null,
    categoryTitle: entry.categoryTitle,
    note: entry.note,
    variant: entry.variant === null ? null : {
      id: entry.variant.id,
      sku: entry.variant.sku,
      // То же правило, что в каталоге: иначе здесь «диван», а там полное название.
      name: variantDisplayName(entry.variant.kaspiMasterTitle, entry.variant.product.name),
      imageUrl: previewImageUrl(entry.variant.kaspiImages),
    },
  };
}
