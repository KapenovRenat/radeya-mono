import type { Prisma } from '../../generated/prisma/client';

/**
 * Поиск товара по части строки без регистра — те же поля, что у поиска
 * каталога (`buildWhere` в catalog.query.ts): артикул, модель, оба названия
 * Kaspi. Там SQL, здесь Prisma: каталогу нужна сортировка по складам, которую
 * Prisma не выразит, а остальным спискам (выбор товара в документ) хватает этого.
 *
 * Добавляешь поле в поиск каталога — добавь и сюда, иначе в окне выбора
 * не найдётся то, что находится в каталоге.
 */
export function variantSearchWhere(search: string): Prisma.VariantWhereInput {
  if (search === '') return {};

  const contains = { contains: search, mode: 'insensitive' as const };

  return {
    OR: [
      { sku: contains },
      { product: { name: contains } },
      { kaspiMasterTitle: contains },
      { kaspiTitle: contains },
    ],
  };
}
