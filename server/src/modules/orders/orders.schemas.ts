import { z } from 'zod';
import {
  CATALOG_DEFAULT_PAGE_SIZE,
  CATALOG_PAGE_SIZES,
  CATALOG_SEARCH_MAX_LENGTH,
  KASPI_ORDER_PERIODS,
  KASPI_SYNC_DEFAULT_CHUNKS,
  KASPI_SYNC_MAX_CHUNKS,
} from '@radeya/shared';

/** Список заказов из базы: страница, размер и поиск по номеру. */
export const orderListSchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int()
    .refine((size): size is (typeof CATALOG_PAGE_SIZES)[number] =>
      CATALOG_PAGE_SIZES.includes(size as (typeof CATALOG_PAGE_SIZES)[number]))
    .default(CATALOG_DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(CATALOG_SEARCH_MAX_LENGTH).optional(),
  // Время, а не дата: границы суток зависят от часового пояса, и переводить
  // «YYYY-MM-DD» в момент должен тот, кто знает пояс пользователя, — клиент.
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
}).strict()
  .refine((query) => !query.from || !query.to || query.from <= query.to,
    'Начало периода позже конца');

/** Одна страница заказов для просмотра. Период — днями назад от текущего момента. */
export const kaspiOrdersQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(730).default(14),
  page: z.coerce.number().int().min(0).default(0),
  // Больше сотни Kaspi всё равно не отдаёт.
  pageSize: z.coerce.number().int().min(1).max(100).default(100),
  // `?raw=1` добавляет к ответу сырые заказы целиком. Не по умолчанию:
  // это удваивает вес ответа, а нужен он только при разборе расхождений.
  raw: z.coerce.number().int().min(0).max(1).default(0),
});

/**
 * Шаг синхронизации.
 *
 * `to` — правый край всего периода, его задаёт первый вызов и повторяют
 * остальные: без якоря окно ползло бы за временем между шагами.
 * `cursor` — граница, с которой продолжать; пусто на первом шаге.
 */
export const syncOrdersSchema = z.object({
  period: z.enum([KASPI_ORDER_PERIODS.LAST_3_MONTHS, KASPI_ORDER_PERIODS.LAST_2_YEARS]),
  to: z.string().datetime().optional(),
  cursor: z.string().datetime().optional(),
  maxChunks: z.number().int().min(1).max(KASPI_SYNC_MAX_CHUNKS)
    .default(KASPI_SYNC_DEFAULT_CHUNKS),
}).strict();

export type KaspiOrdersQuery = z.infer<typeof kaspiOrdersQuerySchema>;
export type OrderListInput = z.infer<typeof orderListSchema>;
export type SyncOrdersInput = z.infer<typeof syncOrdersSchema>;
