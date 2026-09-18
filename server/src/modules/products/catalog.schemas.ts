import { z } from 'zod';
import { CATALOG_DEFAULT_PAGE_SIZE, CATALOG_MOVE_MAX_PRODUCTS,
  CATALOG_PAGE_SIZES, CATALOG_SEARCH_MAX_LENGTH } from '@radeya/shared';

const MAX_PAGE = 1_000_000;
const positiveQueryInteger = z.string().regex(/^[1-9][0-9]*$/).transform(Number);

export const catalogQuerySchema = z.object({
  page: positiveQueryInteger.pipe(z.number().int().max(MAX_PAGE)).default(1),
  pageSize: positiveQueryInteger.pipe(z.union([
    z.literal(CATALOG_PAGE_SIZES[0]), z.literal(CATALOG_PAGE_SIZES[1]),
    z.literal(CATALOG_PAGE_SIZES[2]),
  ])).default(CATALOG_DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(CATALOG_SEARCH_MAX_LENGTH).default(''),
  categoryId: z.string().uuid().optional(),
}).strict();

export const moveProductsSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1).max(CATALOG_MOVE_MAX_PRODUCTS)
    .transform((ids) => [...new Set(ids)]),
  categoryId: z.string().uuid().nullable(),
}).strict();

export type CatalogInput = z.infer<typeof catalogQuerySchema>;
export type MoveProductsInput = z.infer<typeof moveProductsSchema>;
