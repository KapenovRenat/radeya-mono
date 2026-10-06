import {
  variantDisplayName,
  type StockDocumentDto,
  type StockDocumentListItemDto,
  type StockVariantDto,
} from '@radeya/shared';

import type { Prisma } from '../../generated/prisma/client';
import { previewImageUrl } from '../products/catalog.mapper';

/**
 * Выборки и DTO документов склада. Наружу — явный набор полей:
 * у сотрудника, например, только id и имя, без логина и роли.
 */

const personSelect = { id: true, name: true } as const;

export const stockDocumentListSelect = {
  id: true, number: true, type: true, comment: true, totalAmount: true,
  postedAt: true, createdAt: true, updatedAt: true,
  warehouse: { select: { id: true, code: true, name: true } },
  createdBy: { select: personSelect },
  postedBy: { select: personSelect },
  _count: { select: { lines: true } },
} as const satisfies Prisma.StockDocumentSelect;

/**
 * Товар для документа. Остаток — только по одному складу: складу документа
 * или складу, выбранному в окне выбора.
 */
export function stockVariantSelect(warehouseId: string) {
  return {
    id: true, sku: true, kaspiMasterTitle: true, kaspiImages: true, costPrice: true,
    product: { select: { name: true } },
    stocks: { where: { warehouseId }, select: { quantity: true } },
  } as const satisfies Prisma.VariantSelect;
}

type ListRecord = Prisma.StockDocumentGetPayload<{ select: typeof stockDocumentListSelect }>;
type VariantRecord = Prisma.VariantGetPayload<{ select: ReturnType<typeof stockVariantSelect> }>;

export interface LineRecord {
  id: string;
  quantity: number;
  price: Prisma.Decimal;
  amount: Prisma.Decimal;
  variant: VariantRecord;
}

/** Десятичное в строку: number на деньгах теряет тиын. */
function money(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

export function toStockVariantDto(variant: VariantRecord): StockVariantDto {
  return {
    id: variant.id,
    sku: variant.sku,
    name: variantDisplayName(variant.kaspiMasterTitle, variant.product.name),
    imageUrl: previewImageUrl(variant.kaspiImages),
    costPrice: variant.costPrice === null ? null : money(variant.costPrice),
    quantity: variant.stocks[0]?.quantity ?? null,
  };
}

export function toStockDocumentListItem(record: ListRecord): StockDocumentListItemDto {
  return {
    id: record.id,
    number: record.number,
    type: record.type,
    warehouse: record.warehouse,
    comment: record.comment,
    totalAmount: money(record.totalAmount),
    linesCount: record._count.lines,
    postedAt: record.postedAt?.toISOString() ?? null,
    postedBy: record.postedBy,
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toStockDocumentDto(record: ListRecord, lines: LineRecord[]): StockDocumentDto {
  return {
    ...toStockDocumentListItem(record),
    lines: lines.map((line) => ({
      id: line.id,
      variant: toStockVariantDto(line.variant),
      quantity: line.quantity,
      price: money(line.price),
      amount: money(line.amount),
    })),
  };
}
