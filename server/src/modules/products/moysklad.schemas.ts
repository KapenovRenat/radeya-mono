import { z } from 'zod';
import {
  CURRENCIES,
  MOYSKLAD_IMPORT_MAX_ROWS,
  MOYSKLAD_MAX_DAYS_ON_STOCK,
  MOYSKLAD_MAX_PREORDER_DAYS,
  MOYSKLAD_MAX_STOCK_QUANTITY,
} from '@radeya/shared';

/**
 * Валидация импорта из МойСклада.
 *
 * Строки предпросмотра возвращаются от клиента, и доверять им нельзя: между
 * показом и записью лежит сеть. Поэтому схема строки повторяет контракт
 * целиком, включая границы срока предзаказа — он уходит на площадку.
 */

export const previewMoyskladSchema = z.object({
  sheet: z.string().trim().min(1).optional(),
}).strict();

const moyskladDraftSchema = z.object({
  row: z.number().int().nonnegative(),
  code: z.string().trim().min(1).nullable(),
  name: z.string().trim().min(1).nullable(),
  duplicate: z.boolean(),
  variantId: z.string().uuid().nullable(),
  variantSku: z.string().nullable(),
  // Деньги строкой с двумя знаками: number на цене теряет тиын.
  purchasePrice: z.string().regex(/^\d+\.\d{2}$/).nullable(),
  currency: z.enum([CURRENCIES.KZT, CURRENCIES.RUB]).nullable(),
  supplierName: z.string().nullable(),
  supplierId: z.string().uuid().nullable(),
  stocks: z.array(z.object({
    warehouseCode: z.string().trim().min(1),
    warehouseName: z.string(),
    preOrderDays: z.number().int().min(0).max(MOYSKLAD_MAX_PREORDER_DAYS),
  })),
  problems: z.array(z.object({
    column: z.string().nullable(),
    message: z.string(),
  })),
}).strict();

export const commitMoyskladSchema = z.object({
  sheet: z.string().trim().min(1),
  rows: z.array(moyskladDraftSchema).min(1).max(MOYSKLAD_IMPORT_MAX_ROWS),
}).strict();

export type PreviewMoyskladInput = z.infer<typeof previewMoyskladSchema>;
export type CommitMoyskladInput = z.infer<typeof commitMoyskladSchema>;

/**
 * Импорт остатков. Склад обязателен уже на предпросмотре: от него зависит,
 * что обнулится, а это главное, что человек должен увидеть до записи.
 */
export const previewStockSchema = z.object({
  warehouseId: z.string().uuid(),
  sheet: z.string().trim().min(1).optional(),
}).strict();

const stockCount = z.number().int().min(-MOYSKLAD_MAX_STOCK_QUANTITY).max(MOYSKLAD_MAX_STOCK_QUANTITY);

const stockRowSchema = z.object({
  row: z.number().int().nonnegative(),
  code: z.string().trim().min(1).nullable(),
  name: z.string().nullable(),
  duplicate: z.boolean(),
  invalid: z.boolean(),
  variantId: z.string().uuid().nullable(),
  variantSku: z.string().nullable(),
  quantity: stockCount,
  reserved: stockCount,
  expected: stockCount,
  costPrice: z.string().regex(/^\d+\.\d{2}$/).nullable(),
  daysOnStock: z.number().nonnegative().max(MOYSKLAD_MAX_DAYS_ON_STOCK).nullable(),
  problems: z.array(z.object({
    column: z.string().nullable(),
    message: z.string(),
  })),
}).strict();

export const commitStockSchema = z.object({
  sheet: z.string().trim().min(1),
  warehouseId: z.string().uuid(),
  stockAt: z.string().datetime().nullable(),
  rows: z.array(stockRowSchema).max(MOYSKLAD_IMPORT_MAX_ROWS),
  zeroVariantIds: z.array(z.string().uuid()).max(MOYSKLAD_IMPORT_MAX_ROWS),
}).strict();

export type PreviewStockInput = z.infer<typeof previewStockSchema>;
export type CommitStockInput = z.infer<typeof commitStockSchema>;
