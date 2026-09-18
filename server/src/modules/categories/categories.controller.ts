import type { RequestHandler } from 'express';
import { AUDIT_ACTIONS } from '@radeya/shared';
import { clientIp, logAction } from '../../lib/audit';
import { ValidationError } from '../../lib/errors';
import { createCategorySchema } from './categories.schemas';
import { createCategory, getCategoryTree } from './categories.service';

export const getCategories: RequestHandler = async (_req, res) => {
  res.json(await getCategoryTree());
};
export const postCategory: RequestHandler = async (req, res) => {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError('Проверьте название и родительскую папку');
  const category = await createCategory(parsed.data);
  const author = req.user!;
  await logAction({ userId: author.id, userLogin: author.login, userRole: author.role,
    action: AUDIT_ACTIONS.CATEGORY_CREATED, entityType: 'Category', entityId: category.id,
    after: category, ip: clientIp(req) });
  res.status(201).json(category);
};
