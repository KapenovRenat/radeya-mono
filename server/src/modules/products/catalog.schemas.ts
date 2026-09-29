import { z } from 'zod';
import { CATALOG_DEFAULT_PAGE_SIZE, CATALOG_FILTER_MAX_VALUES, CATALOG_MOVE_MAX_PRODUCTS,
  CATALOG_NO_SUPPLIER, CATALOG_PAGE_SIZES, CATALOG_SEARCH_MAX_LENGTH, CATALOG_SORT_KEYS,
  SORT_ORDERS, type CatalogSortKey } from '@radeya/shared';

const MAX_PAGE = 1_000_000;
const positiveQueryInteger = z.string().regex(/^[1-9][0-9]*$/).transform(Number);

/**
 * Список в адресе через запятую: `?warehouseIds=a,b`. Пустая строка — пустой
 * список, повторы сворачиваются.
 */
const splitList = (value: string): string[] =>
  [...new Set(value.split(',').map((part) => part.trim()).filter(Boolean))];

const warehouseIdsSchema = z.string().transform(splitList)
  .pipe(z.array(z.string().uuid()).max(CATALOG_FILTER_MAX_VALUES));

const supplierIdsSchema = z.string().transform(splitList)
  .pipe(z.array(z.union([z.string().uuid(), z.literal(CATALOG_NO_SUPPLIER)]))
    .max(CATALOG_FILTER_MAX_VALUES));

export const catalogQuerySchema = z.object({
  page: positiveQueryInteger.pipe(z.number().int().max(MAX_PAGE)).default(1),
  pageSize: positiveQueryInteger.pipe(z.union([
    z.literal(CATALOG_PAGE_SIZES[0]), z.literal(CATALOG_PAGE_SIZES[1]),
    z.literal(CATALOG_PAGE_SIZES[2]),
  ])).default(CATALOG_DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(CATALOG_SEARCH_MAX_LENGTH).default(''),
  categoryId: z.string().uuid().optional(),
  warehouseIds: warehouseIdsSchema.default([]),
  supplierIds: supplierIdsSchema.default([]),
  sort: z.enum(Object.values(CATALOG_SORT_KEYS) as [CatalogSortKey, ...CatalogSortKey[]]).optional(),
  order: z.enum([SORT_ORDERS.ASC, SORT_ORDERS.DESC]).default(SORT_ORDERS.DESC),
}).strict();

export const moveProductsSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1).max(CATALOG_MOVE_MAX_PRODUCTS)
    .transform((ids) => [...new Set(ids)]),
  categoryId: z.string().uuid().nullable(),
}).strict();

export type CatalogInput = z.infer<typeof catalogQuerySchema>;
export type MoveProductsInput = z.infer<typeof moveProductsSchema>;
