import type { RequestHandler } from 'express';
import { AUDIT_ACTIONS } from '@radeya/shared';
import { clientIp, logAction } from '../../lib/audit';
import { ValidationError } from '../../lib/errors';
import { categoryParamsSchema, createCategorySchema, renameCategorySchema,
  reorderCategoriesSchema } from './categories.schemas';
import { createCategory, getCategoryTree, renameCategory, reorderCategories,
  deleteCategory } from './categories.service';

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

export const patchCategory: RequestHandler = async (req, res) => {
  const params = categoryParamsSchema.safeParse(req.params);
  const body = renameCategorySchema.safeParse(req.body);
  if (!params.success || !body.success) throw new ValidationError('Проверьте категорию и название');
  const { before, after } = await renameCategory(params.data.id, body.data.name);
  if (before.name !== after.name) {
    const author = req.user!;
    await logAction({ userId: author.id, userLogin: author.login, userRole: author.role,
      action: AUDIT_ACTIONS.CATEGORY_RENAMED, entityType: 'Category', entityId: after.id,
      before, after, ip: clientIp(req) });
  }
  res.json(after);
};

export const patchCategoriesOrder: RequestHandler = async (req, res) => {
  const parsed = reorderCategoriesSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError('Проверьте уровень и список категорий');
  const { updated, before, after } = await reorderCategories(parsed.data);
  // Порядок не поменялся — в журнал не пишем: иначе он забьётся пустыми записями.
  if (updated > 0) {
    const author = req.user!;
    await logAction({ userId: author.id, userLogin: author.login, userRole: author.role,
      action: AUDIT_ACTIONS.CATEGORIES_REORDERED, entityType: 'Category',
      entityId: parsed.data.parentId ?? undefined,
      before: { ids: before }, after: { ids: after }, ip: clientIp(req) });
  }
  res.json({ updated });
};

export const removeCategory: RequestHandler = async (req, res) => {
  const params = categoryParamsSchema.safeParse(req.params);
  if (!params.success) throw new ValidationError('Некорректная категория');
  const before = await deleteCategory(params.data.id);
  const author = req.user!;
  await logAction({ userId: author.id, userLogin: author.login, userRole: author.role,
    action: AUDIT_ACTIONS.CATEGORY_DELETED, entityType: 'Category', entityId: before.id,
    before, ip: clientIp(req) });
  res.json({ id: before.id });
};
