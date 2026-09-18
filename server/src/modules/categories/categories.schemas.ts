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
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
