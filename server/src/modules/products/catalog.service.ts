import type { CatalogResponse } from '@radeya/shared';
import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../db/client';
import { NotFoundError } from '../../lib/errors';
import { catalogRowSelect, toCatalogRow } from './catalog.mapper';
import type { CatalogInput, MoveProductsInput } from './catalog.schemas';

export async function listCatalog(input: CatalogInput): Promise<CatalogResponse> {
  // Страница и счётчик относятся к одному снимку, даже если параллельно идёт импорт.
  return prisma.$transaction(async (tx) => {
    const conditions: Prisma.VariantWhereInput[] = [];
    if (input.categoryId) {
      const category = await tx.category.findUnique({ where: { id: input.categoryId },
        select: { id: true, path: true } });
      if (!category) throw new NotFoundError('Категория не найдена');
      conditions.push({ product: { category: { OR: [
        { id: category.id }, { path: { startsWith: category.path + category.id + '/' } },
      ] } } });
    }
    if (input.search) {
      // contains использует LIKE: пользовательские % и _ должны остаться символами.
      const contains = input.search.replace(/[\\%_]/g, (char) => '\\' + char);
      const text = { contains, mode: 'insensitive' as const };
      conditions.push({ OR: [ { sku: text }, { product: { name: text } },
        { kaspiMasterTitle: text }, { kaspiTitle: text } ] });
    }
    const where: Prisma.VariantWhereInput = { AND: conditions };
    const total = await tx.variant.count({ where });
    const totalPages = Math.ceil(total / input.pageSize);
    // После переноса последней строки из папки возвращаем последнюю непустую страницу.
    const page = Math.min(input.page, Math.max(1, totalPages));
    const rows = await tx.variant.findMany({ where, select: catalogRowSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * input.pageSize, take: input.pageSize });
    return { items: rows.map(toCatalogRow), total, page, pageSize: input.pageSize, totalPages };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

/** Переносится Product со всеми модификациями, а не только видимый артикул. */
export async function moveProductsToCategory(input: MoveProductsInput) {
  return prisma.$transaction(async (tx) => {
    if (input.categoryId) {
      const category = await tx.category.findUnique({ where: { id: input.categoryId },
        select: { id: true } });
      if (!category) throw new NotFoundError('Категория не найдена');
    }
    const before = await tx.product.findMany({ where: { id: { in: input.productIds } },
      select: { id: true, categoryId: true } });
    if (before.length !== input.productIds.length) {
      throw new NotFoundError('Часть выбранных товаров не найдена. Обновите таблицу');
    }
    const changed = before.filter((product) => product.categoryId !== input.categoryId);
    if (changed.length) await tx.product.updateMany({
      where: { id: { in: changed.map((product) => product.id) } },
      data: { categoryId: input.categoryId },
    });
    return { updated: changed.length, before: changed };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
