import type { CatalogImageDto, CatalogRowDto } from '@radeya/shared';
import type { Prisma } from '../../generated/prisma/client';

/**
 * Выборка строки каталога — всё, что есть на артикуле.
 *
 * Историю изменений не берём: она в `AuditLog`, и в списке дала бы запрос
 * на каждую строку. Её отдаёт `GET /api/audit` с фильтром по товару.
 *
 * Закупка здесь есть намеренно: эндпоинт закрыт ролью ADMIN, и в дашборде
 * закупка нужна. На витрину этот DTO не отдаётся — см. CatalogRowDto.
 */
export const catalogRowSelect = {
  id: true, productId: true, sku: true, barcode: true, status: true, sortOrder: true,
  createdAt: true, updatedAt: true,
  kaspiMasterTitle: true, kaspiTitle: true, kaspiModel: true, kaspiMasterSku: true,
  kaspiOfferId: true, kaspiFileId: true, kaspiMerchantUid: true, kaspiShopLink: true,
  kaspiImages: true, kaspiUpdates: true, kaspiUpdatedAt: true,
  anyKaspiDelivery: true, anyKaspiDeliveryExpress: true, anyKaspiDeliveryLocal: true,
  anyMerchantDelivery: true, siteDelivery: true,
  purchasePrice: true, purchaseCurrency: true, minChannelPrice: true, maxChannelPrice: true,
  supplier: { select: { id: true, name: true } },
  product: { select: { name: true, slug: true, description: true, brand: true,
    isActive: true, kaspiFamilyId: true, createdAt: true, updatedAt: true,
    category: { select: { id: true, name: true } } } },
  fabric: { select: { id: true, name: true, code: true, type: true } },
  fabricShade: { select: { id: true, name: true, code: true, hex: true, imageUrl: true } },
  listings: { select: { id: true, channel: true, status: true, price: true,
    discountPrice: true, discountPercent: true, externalId: true, externalSku: true,
    externalUrl: true, publishedAt: true, lastSyncedAt: true, syncError: true },
    orderBy: { channel: 'asc' } },
  costPrice: true,
  stocks: { select: { quantity: true, reserved: true, expected: true, receivedAt: true,
    stockAt: true, preOrderDays: true,
    warehouse: { select: { id: true, code: true, name: true, kaspiStoreId: true,
      kaspiCityId: true, isActive: true } } },
    orderBy: { warehouseId: 'asc' } },
} as const satisfies Prisma.VariantSelect;

type CatalogRecord = Prisma.VariantGetPayload<{ select: typeof catalogRowSelect }>;

/** Десятичное в строку: number на цене теряет тиын и складывается с ошибкой. */
function money(value: Prisma.Decimal | null): string | null {
  return value?.toFixed(2) ?? null;
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    // Невалидная ссылка не должна ломать весь каталог.
    return false;
  }
}

/** Kaspi отдаёт `{ small, medium, large }`, но полнота размеров не гарантирована. */
function readImages(images: Prisma.JsonValue): CatalogImageDto[] {
  if (!Array.isArray(images)) return [];
  const result: CatalogImageDto[] = [];
  for (const image of images) {
    if (!image || typeof image !== 'object' || Array.isArray(image)) continue;
    const small = isHttpUrl(image.small) ? image.small : null;
    const medium = isHttpUrl(image.medium) ? image.medium : null;
    const large = isHttpUrl(image.large) ? image.large : null;
    if (small || medium || large) result.push({ small, medium, large });
  }
  return result;
}

/** Снимок хранится как есть, но форму не гарантирует никто: в базе может лежать null. */
function readUpdates(updates: Prisma.JsonValue): unknown[] {
  return Array.isArray(updates) ? updates : [];
}

function previewUrl(images: CatalogImageDto[]): string | null {
  for (const image of images) {
    const url = image.small ?? image.medium ?? image.large;
    if (url) return url;
  }
  return null;
}

/**
 * Доступно = Остаток − Резерв + Ожидание — формула МойСклада, сверена на отчёте.
 * Не указанное слагаемое считается нулём, но если не указано ничего — это
 * «неизвестно», а не ноль.
 */
function availableStock(quantity: number | null, reserved: number | null,
  expected: number | null): number | null {
  if (quantity === null && reserved === null && expected === null) return null;
  return (quantity ?? 0) - (reserved ?? 0) + (expected ?? 0);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Дней с даты до `now`, два знака — как в отчёте МойСклада. */
function daysSince(from: Date | null, now: Date): number | null {
  if (from === null) return null;
  return Math.max(0, Math.round(((now.getTime() - from.getTime()) / DAY_MS) * 100) / 100);
}

/** `now` один на страницу: у соседних строк «дней на складе» не должны разъехаться на миллисекунды. */
export function toCatalogRow(row: CatalogRecord, now: Date = new Date()): CatalogRowDto {
  const images = readImages(row.kaspiImages);
  return {
    variantId: row.id, productId: row.productId, name: row.product.name,
    sku: row.sku, barcode: row.barcode, brand: row.product.brand,
    category: row.product.category, imageUrl: previewUrl(images), images,
    status: row.status, productIsActive: row.product.isActive,
    fabric: row.fabric, fabricShade: row.fabricShade,
    listings: row.listings.map((listing) => ({
      id: listing.id, channel: listing.channel, status: listing.status,
      price: money(listing.price), discountPrice: money(listing.discountPrice),
      discountPercent: listing.discountPercent,
      externalId: listing.externalId, externalSku: listing.externalSku,
      externalUrl: listing.externalUrl, publishedAt: iso(listing.publishedAt),
      lastSyncedAt: iso(listing.lastSyncedAt), syncError: listing.syncError,
    })),
    stocks: row.stocks.map((stock) => ({ warehouse: stock.warehouse,
      quantity: stock.quantity, reserved: stock.reserved, expected: stock.expected,
      available: availableStock(stock.quantity, stock.reserved, stock.expected),
      daysOnStock: daysSince(stock.receivedAt, now),
      stockAt: iso(stock.stockAt), preOrderDays: stock.preOrderDays })),

    // Пустой остаток — «не указано», но в сумме считать его нечем, кроме нуля.
    totalStock: row.stocks.reduce((sum, stock) => sum + (stock.quantity ?? 0), 0),
    preOrderDays: row.stocks.reduce((max, stock) => Math.max(max, stock.preOrderDays), 0),

    purchasePrice: money(row.purchasePrice),
    purchaseCurrency: row.purchaseCurrency,
    costPrice: money(row.costPrice),
    supplier: row.supplier,
    minChannelPrice: money(row.minChannelPrice),
    maxChannelPrice: money(row.maxChannelPrice),

    kaspi: {
      masterTitle: row.kaspiMasterTitle, title: row.kaspiTitle, model: row.kaspiModel,
      masterSku: row.kaspiMasterSku, offerId: row.kaspiOfferId, fileId: row.kaspiFileId,
      merchantUid: row.kaspiMerchantUid, shopLink: row.kaspiShopLink,
      updatedAt: iso(row.kaspiUpdatedAt), updates: readUpdates(row.kaspiUpdates),
    },
    delivery: {
      any: row.anyKaspiDelivery, express: row.anyKaspiDeliveryExpress,
      local: row.anyKaspiDeliveryLocal, merchant: row.anyMerchantDelivery,
      site: row.siteDelivery,
    },
    product: {
      slug: row.product.slug, description: row.product.description,
      kaspiFamilyId: row.product.kaspiFamilyId,
      createdAt: row.product.createdAt.toISOString(),
      updatedAt: row.product.updatedAt.toISOString(),
    },
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
