import type { CatalogRowDto } from '@radeya/shared';
import type { Prisma } from '../../generated/prisma/client';

/** Закупка, история и технические поля Kaspi не загружаются даже из БД. */
export const catalogRowSelect = {
  id: true, productId: true, sku: true, barcode: true, status: true, kaspiImages: true,
  product: { select: { name: true, brand: true, isActive: true,
    category: { select: { id: true, name: true } } } },
  fabric: { select: { id: true, name: true } },
  fabricShade: { select: { id: true, name: true } },
  listings: { select: { channel: true, status: true, price: true,
    discountPrice: true, discountPercent: true }, orderBy: { channel: 'asc' } },
  stocks: { select: { quantity: true, preOrderDays: true,
    warehouse: { select: { id: true, code: true, name: true } } },
    orderBy: { warehouseId: 'asc' } },
} as const satisfies Prisma.VariantSelect;

type CatalogRecord = Prisma.VariantGetPayload<{ select: typeof catalogRowSelect }>;

function firstImageUrl(images: Prisma.JsonValue): string | null {
  if (!Array.isArray(images)) return null;
  for (const image of images) {
    if (!image || typeof image !== 'object' || Array.isArray(image)) continue;
    for (const key of ['small', 'medium', 'large']) {
      const url = image[key];
      if (typeof url !== 'string') continue;
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return url;
      } catch { /* Невалидная ссылка не должна ломать весь каталог. */ }
    }
  }
  return null;
}

export function toCatalogRow(row: CatalogRecord): CatalogRowDto {
  return {
    variantId: row.id, productId: row.productId, name: row.product.name,
    sku: row.sku, barcode: row.barcode, brand: row.product.brand,
    category: row.product.category, imageUrl: firstImageUrl(row.kaspiImages),
    status: row.status, productIsActive: row.product.isActive,
    fabric: row.fabric, fabricShade: row.fabricShade,
    listings: row.listings.map((listing) => ({
      channel: listing.channel, status: listing.status,
      price: listing.price?.toFixed(2) ?? null,
      discountPrice: listing.discountPrice?.toFixed(2) ?? null,
      discountPercent: listing.discountPercent,
    })),
    stocks: row.stocks.map((stock) => ({ warehouse: stock.warehouse,
      quantity: stock.quantity, preOrderDays: stock.preOrderDays })),
  };
}
