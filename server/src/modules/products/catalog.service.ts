import { AUDIT_ACTIONS, HISTORY_ENTITY_TYPES, type CatalogResponse } from '@radeya/shared';
import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../db/client';
import { NotFoundError } from '../../lib/errors';
import { diffFields, recordHistory, type HistoryMeta } from '../../lib/history';
import { catalogRowSelect, toCatalogRow } from './catalog.mapper';
import { selectCatalogPage } from './catalog.query';
import type { CatalogInput, MoveProductsInput } from './catalog.schemas';

/**
 * Страница каталога: поиск, папка, фильтры по складам и поставщикам, сортировка.
 * Порядок и id строк считает SQL (см. catalog.query.ts), строки — Prisma.
 */
export async function listCatalog(input: CatalogInput): Promise<CatalogResponse> {
  // Страница и счётчик относятся к одному снимку, даже если параллельно идёт импорт.
  return prisma.$transaction(async (tx) => {
    let category: { id: string; path: string } | null = null;
    if (input.categoryId) {
      category = await tx.category.findUnique({ where: { id: input.categoryId },
        select: { id: true, path: true } });
      if (!category) throw new NotFoundError('Категория не найдена');
    }

    const { ids, total, page } = await selectCatalogPage(tx, input, category);

    // При фильтре по складам в строке остаются только выбранные склады:
    // иначе колонка «Остаток» показывала бы склад, которого человек не просил.
    const stockWhere: Prisma.VariantStockWhereInput | undefined = input.warehouseIds.length === 0
      ? undefined : { warehouseId: { in: input.warehouseIds } };
    const select = { ...catalogRowSelect,
      stocks: { ...catalogRowSelect.stocks, where: stockWhere } };
    const rows = await tx.variant.findMany({ where: { id: { in: ids } }, select });

    // findMany порядок не сохраняет — раскладываем по порядку из SQL.
    const byId = new Map(rows.map((row) => [row.id, row]));
    const now = new Date();
    const items = ids.flatMap((id) => {
      const row = byId.get(id);
      return row === undefined ? [] : [toCatalogRow(row, now)];
    });

    return { items, total, page, pageSize: input.pageSize,
      totalPages: Math.ceil(total / input.pageSize) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

/**
 * Переносится Product со всеми модификациями, а не только видимый артикул.
 * В историю каждого товара — папка названием, «было → стало», в той же транзакции.
 */
export async function moveProductsToCategory(input: MoveProductsInput, meta: HistoryMeta) {
  return prisma.$transaction(async (tx) => {
    let targetName: string | null = null;
    if (input.categoryId) {
      const category = await tx.category.findUnique({ where: { id: input.categoryId },
        select: { id: true, name: true } });
      if (!category) throw new NotFoundError('Категория не найдена');
      targetName = category.name;
    }
    const before = await tx.product.findMany({ where: { id: { in: input.productIds } },
      select: { id: true, categoryId: true, category: { select: { name: true } } } });
    if (before.length !== input.productIds.length) {
      throw new NotFoundError('Часть выбранных товаров не найдена. Обновите таблицу');
    }
    const changed = before.filter((product) => product.categoryId !== input.categoryId);
    if (changed.length) await tx.product.updateMany({
      where: { id: { in: changed.map((product) => product.id) } },
      data: { categoryId: input.categoryId },
    });
    await recordHistory(tx, meta, changed.map((product) => ({
      type: AUDIT_ACTIONS.PRODUCTS_CATEGORY_CHANGED,
      entityType: HISTORY_ENTITY_TYPES.PRODUCT,
      entityId: product.id,
      changes: diffFields(HISTORY_ENTITY_TYPES.PRODUCT,
        { category: product.category?.name ?? null }, { category: targetName }),
    })));
    return {
      updated: changed.length,
      before: changed.map((product) => ({ id: product.id, categoryId: product.categoryId })),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
