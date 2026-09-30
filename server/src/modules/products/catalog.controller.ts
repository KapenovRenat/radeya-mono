import type { RequestHandler } from 'express';
import {
  AUDIT_ACTIONS, CATALOG_PURCHASE_ROLES, CATALOG_SORT_KEYS, HISTORY_SOURCES, hasRole,
} from '@radeya/shared';
import { Prisma } from '../../generated/prisma/client';
import { clientIp, logAction } from '../../lib/audit';
import { ConflictError, ForbiddenError, ValidationError } from '../../lib/errors';
import { hideCatalogMoney } from './catalog.mapper';
import { catalogQuerySchema, moveProductsSchema } from './catalog.schemas';
import { listCatalog, moveProductsToCategory } from './catalog.service';

export const getCatalog: RequestHandler = async (req, res) => {
  const parsed = catalogQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ValidationError('Проверьте поиск, категорию и параметры страницы');
  const role = req.user!.role;
  // Порядок строк по закупке выдаёт её саму: кто закупку не видит, по ней и не сортирует.
  if (parsed.data.sort === CATALOG_SORT_KEYS.PURCHASE_PRICE && !hasRole(role, CATALOG_PURCHASE_ROLES)) {
    throw new ForbiddenError('Сортировка по закупке недоступна');
  }
  res.json(hideCatalogMoney(await listCatalog(parsed.data), role));
};
export const patchProductsCategory: RequestHandler = async (req, res) => {
  const parsed = moveProductsSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError('Выберите от 1 до 100 товаров и целевую папку');
  const author = req.user!;
  let result;
  try {
    result = await moveProductsToCategory(parsed.data, {
      author, source: HISTORY_SOURCES.MANUAL, ip: clientIp(req),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new ConflictError('Товары изменились. Повторите перенос');
    }
    throw error;
  }
  if (result.updated) {
    await logAction({ userId: author.id, userLogin: author.login, userRole: author.role,
      action: AUDIT_ACTIONS.PRODUCTS_CATEGORY_CHANGED, entityType: 'Product',
      before: result.before, after: { categoryId: parsed.data.categoryId,
        productIds: result.before.map((product) => product.id) }, ip: clientIp(req) });
  }
  res.json({ updated: result.updated });
};
