import { z } from 'zod';

/**
 * Период сводки.
 *
 * Время, а не даты: границы суток зависят от часового пояса, и «за сентябрь»
 * в Алматы и в UTC — разные наборы заказов. Переводит выбранные даты в моменты
 * клиент, он же считает «текущий месяц» и «прошлый месяц».
 */
export const orderStatsSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
}).strict()
  .refine((query) => !query.from || !query.to || query.from <= query.to,
    'Начало периода позже конца');

export type OrderStatsInput = z.infer<typeof orderStatsSchema>;
