import { z } from 'zod';

/**
 * Загрузка каталога из кабинета.
 *
 * Кука не проверяется на формат: это чужой заголовок, его состав задаёт Kaspi,
 * и любая наша «проверка правильности» однажды отвергнет рабочее значение.
 * Ограничиваем только длину — чтобы в поле не прислали мегабайт.
 */
const MAX_COOKIE_LENGTH = 8192;

export const fetchCabinetSchema = z.object({
  cookie: z.string().max(MAX_COOKIE_LENGTH, 'Слишком длинная строка').optional(),
  remember: z.boolean().optional(),
});

export type FetchCabinetInput = z.infer<typeof fetchCabinetSchema>;
