import { z } from 'zod';
import { SALES_POINT_NAME_MAX_LENGTH } from '@radeya/shared';

/**
 * Создание точки. Ни тип, ни код не принимаются: через API заводится только
 * офлайн-точка, а код генерит сервер. Если позволить прислать код, однажды
 * придёт `KASPI` — и синхронизация начнёт писать заказы площадки в чужую строку.
 */
export const createSalesPointSchema = z.object({
  name: z.string().trim().min(1).max(SALES_POINT_NAME_MAX_LENGTH),
}).strict();

/** Переименование и закрытие. Пустое тело отклоняем: это почти всегда ошибка клиента. */
export const updateSalesPointSchema = z.object({
  name: z.string().trim().min(1).max(SALES_POINT_NAME_MAX_LENGTH).optional(),
  isActive: z.boolean().optional(),
}).strict()
  .refine((body) => body.name !== undefined || body.isActive !== undefined,
    'Не указано, что менять');

export const salesPointParamsSchema = z.object({ id: z.string().uuid() });

export type CreateSalesPointInput = z.infer<typeof createSalesPointSchema>;
export type UpdateSalesPointInput = z.infer<typeof updateSalesPointSchema>;
