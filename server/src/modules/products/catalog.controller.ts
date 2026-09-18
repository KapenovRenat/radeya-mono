import type { RequestHandler } from 'express';
import { AUDIT_ACTIONS } from '@radeya/shared';
import { Prisma } from '../../generated/prisma/client';
import { clientIp, logAction } from '../../lib/audit';
import { ConflictError, ValidationError } from '../../lib/errors';
import { catalogQuerySchema, moveProductsSchema } from './catalog.schemas';
import { listCatalog, moveProductsToCategory } from './catalog.service';

export const getCatalog: RequestHandler = async (req, res) => {
  const parsed = catalogQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ValidationError('Проверьте поиск, категорию и параметры страницы');
  res.json(await listCatalog(parsed.data));
};
export const patchProductsCategory: RequestHandler = async (req, res) => {
  const parsed = moveProductsSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError('Выберите от 1 до 100 товаров и целевую папку');
  let result;
  try {
    result = await moveProductsToCategory(parsed.data);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new ConflictError('Товары изменились. Повторите перенос');
    }
    throw error;
  }
  if (result.updated) {
    const author = req.user!;
    await logAction({ userId: author.id, userLogin: author.login, userRole: author.role,
      action: AUDIT_ACTIONS.PRODUCTS_CATEGORY_CHANGED, entityType: 'Product',
      before: result.before, after: { categoryId: parsed.data.categoryId,
        productIds: result.before.map((product) => product.id) }, ip: clientIp(req) });
  }
  res.json({ updated: result.updated });
};
