import type { CatalogImageDto, CatalogRowDto } from '@radeya/shared';
import type { Prisma } from '../../generated/prisma/client';

/**
 * Выборка строки каталога — всё, что есть на артикуле.
 *
 * `changes` (история VariantChange) не берём: отдельная таблица, в списке
 * она дала бы запрос на каждую строку. Её отдаст карточка товара.
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
  purchasePrice: true, minChannelPrice: true, maxChannelPrice: true,
  product: { select: { name: true, slug: true, description: true, brand: true,
    isActive: true, kaspiFamilyId: true, createdAt: true, updatedAt: true,
    category: { select: { id: true, name: true } } } },
  fabric: { select: { id: true, name: true, code: true, type: true } },
  fabricShade: { select: { id: true, name: true, code: true, hex: true, imageUrl: true } },
  listings: { select: { id: true, channel: true, status: true, price: true,
    discountPrice: true, discountPercent: true, externalId: true, externalSku: true,
    externalUrl: true, publishedAt: true, lastSyncedAt: true, syncError: true },
    orderBy: { channel: 'asc' } },
  stocks: { select: { quantity: true, preOrderDays: true,
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

export function toCatalogRow(row: CatalogRecord): CatalogRowDto {
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
      quantity: stock.quantity, preOrderDays: stock.preOrderDays })),

    // Пустой остаток — «не указано», но в сумме считать его нечем, кроме нуля.
    totalStock: row.stocks.reduce((sum, stock) => sum + (stock.quantity ?? 0), 0),
    preOrderDays: row.stocks.reduce((max, stock) => Math.max(max, stock.preOrderDays), 0),

    purchasePrice: money(row.purchasePrice),
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
