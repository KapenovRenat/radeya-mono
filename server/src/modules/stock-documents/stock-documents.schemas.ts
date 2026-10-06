import { z } from 'zod';
import {
  CATALOG_DEFAULT_PAGE_SIZE,
  CATALOG_PAGE_SIZES,
  CATALOG_SEARCH_MAX_LENGTH,
  STOCK_DOCUMENT_COMMENT_MAX_LENGTH,
  STOCK_DOCUMENT_COMMENT_MIN_LENGTH,
  STOCK_DOCUMENT_MAX_LINES,
  STOCK_DOCUMENT_MAX_QUANTITY,
  STOCK_DOCUMENT_PRICE_PATTERN,
  STOCK_DOCUMENT_TYPES,
  parseStockDocumentNumber,
} from '@radeya/shared';

const MAX_PAGE = 1_000_000;
const positiveQueryInteger = z.string().regex(/^[1-9][0-9]*$/).transform(Number);

const pageSchema = positiveQueryInteger.pipe(z.number().int().max(MAX_PAGE)).default(1);

const typeSchema = z.enum([STOCK_DOCUMENT_TYPES.ENTER, STOCK_DOCUMENT_TYPES.WRITE_OFF]);

/** `00128` и `128` — один документ. */
const documentNumberSchema = z.string().transform((value, ctx) => {
  const number = parseStockDocumentNumber(value);

  if (number === null) {
    ctx.addIssue({ code: 'custom', message: 'Номер документа — до девяти цифр' });

    return z.NEVER;
  }

  return number;
});

export const stockDocumentListQuerySchema = z.object({
  page: pageSchema,
  pageSize: positiveQueryInteger.pipe(z.union([
    z.literal(CATALOG_PAGE_SIZES[0]), z.literal(CATALOG_PAGE_SIZES[1]),
    z.literal(CATALOG_PAGE_SIZES[2]),
  ])).default(CATALOG_DEFAULT_PAGE_SIZE),
  type: typeSchema.optional(),
  warehouseId: z.string().uuid().optional(),
  number: documentNumberSchema.optional(),
}).strict();

export const stockDocumentParamsSchema = z.object({ number: documentNumberSchema });

export const stockPickerQuerySchema = z.object({
  warehouseId: z.string().uuid(),
  search: z.string().trim().max(CATALOG_SEARCH_MAX_LENGTH).default(''),
  page: pageSchema,
}).strict();

const lineSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int('Количество — целое число')
    .min(1, 'Количество — от 1')
    .max(STOCK_DOCUMENT_MAX_QUANTITY, `Количество — не больше ${STOCK_DOCUMENT_MAX_QUANTITY}`),
  price: z.string().trim()
    .regex(STOCK_DOCUMENT_PRICE_PATTERN, 'Цена — число, не больше двух знаков после точки')
    .optional(),
}).strict();

/**
 * Черновик целиком: шапка и полный список строк.
 *
 * Цена обязательна только у оприходования. У списания присланную цену
 * сервер не берёт: списание идёт по себестоимости (см. priceLines).
 */
export const saveStockDocumentSchema = z.object({
  type: typeSchema,
  warehouseId: z.string().uuid(),
  comment: z.string().trim()
    .min(STOCK_DOCUMENT_COMMENT_MIN_LENGTH, 'Заполните комментарий осмысленно')
    .max(STOCK_DOCUMENT_COMMENT_MAX_LENGTH, `Комментарий — не длиннее ${STOCK_DOCUMENT_COMMENT_MAX_LENGTH} символов`),
  lines: z.array(lineSchema)
    .min(1, 'Добавьте хотя бы один товар')
    .max(STOCK_DOCUMENT_MAX_LINES, `Не больше ${STOCK_DOCUMENT_MAX_LINES} товаров в документе`),
  /** Галочка «Проведено»: записать и провести одной транзакцией. Права — в контроллере. */
  post: z.boolean().default(false),
}).strict().superRefine((document, ctx) => {
  const seen = new Set<string>();

  document.lines.forEach((line, index) => {
    // Две строки одного товара — какое количество верное, неизвестно.
    if (seen.has(line.variantId)) {
      ctx.addIssue({ code: 'custom', path: ['lines', index], message: 'Товар добавлен в документ дважды' });
    }

    seen.add(line.variantId);

    if (document.type === STOCK_DOCUMENT_TYPES.ENTER && line.price === undefined) {
      ctx.addIssue({ code: 'custom', path: ['lines', index, 'price'], message: 'Укажите цену' });
    }
  });
});

export type StockDocumentListInput = z.infer<typeof stockDocumentListQuerySchema>;
export type StockPickerInput = z.infer<typeof stockPickerQuerySchema>;
export type SaveStockDocumentInput = z.infer<typeof saveStockDocumentSchema>;
