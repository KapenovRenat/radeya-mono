import { z } from 'zod';
import { ALL_PRODUCTS_LABEL, CATEGORY_NAME_MAX_LENGTH } from '@radeya/shared';

const categoryNameSchema = z.string().trim().min(1).max(CATEGORY_NAME_MAX_LENGTH)
  .refine((name) => name.toLowerCase() !== ALL_PRODUCTS_LABEL.toLowerCase(),
    'Это имя зарезервировано для всего каталога');

export const categoryParamsSchema = z.object({ id: z.string().uuid() });
export const createCategorySchema = z.object({
  name: categoryNameSchema,
  parentId: z.string().uuid().nullable().default(null),
}).strict();
export const renameCategorySchema = z.object({ name: categoryNameSchema }).strict();

/**
 * Порядок папок одного уровня. Верхняя граница — защита от запроса, который
 * положит транзакцию: столько категорий в дереве из двух уровней не бывает.
 */
export const reorderCategoriesSchema = z.object({
  parentId: z.string().uuid().nullable().default(null),
  ids: z.array(z.string().uuid()).min(1).max(200)
    .refine((ids) => new Set(ids).size === ids.length, 'Повторяющиеся категории'),
}).strict();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;
