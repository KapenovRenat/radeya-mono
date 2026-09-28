import { z } from 'zod';
import { CURRENCIES, MOYSKLAD_IMPORT_MAX_ROWS, MOYSKLAD_MAX_PREORDER_DAYS } from '@radeya/shared';

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
