import { randomUUID } from 'node:crypto';
import { ALL_PRODUCTS_LABEL, type CategoryDto, type CategoryTreeNode,
  type CategoryTreeResponse } from '@radeya/shared';
import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../db/client';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors';
import type { CreateCategoryInput, ReorderCategoriesInput } from './categories.schemas';

const CHANGE_ATTEMPTS = 3;
const categorySelect = { id: true, name: true, parentId: true } as const;

export async function getCategoryTree(): Promise<CategoryTreeResponse> {
  const rows = await prisma.category.findMany({
    select: categorySelect,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
  });
  const nodes = new Map<string, CategoryTreeNode>(rows.map((row) => [
    row.id, { ...row, children: [] },
  ]));
  const items: CategoryTreeNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id)!;
    const parent = row.parentId ? nodes.get(row.parentId) : undefined;
    if (parent) parent.children.push(node);
    else items.push(node);
  }
  return { allProducts: { id: null, name: ALL_PRODUCTS_LABEL }, items };
}

/** Serializable защищает уникальность имени, включая корневые папки с NULL parentId. */
async function changeCategory<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < CHANGE_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2034' && attempt + 1 < CHANGE_ATTEMPTS) continue;
        if (error.code === 'P2002') throw new ConflictError('В этой папке уже есть категория с таким названием');
        if (error.code === 'P2025' || error.code === 'P2003') throw new NotFoundError('Категория уже удалена');
        if (error.code === 'P2034') throw new ConflictError('Категории изменились. Повторите действие');
      }
      throw error;
    }
  }
  throw new ConflictError('Повторите действие');
}

export async function createCategory(input: CreateCategoryInput): Promise<CategoryDto> {
  return changeCategory(async (tx) => {
    const parent = input.parentId
      ? await tx.category.findUnique({ where: { id: input.parentId },
          select: { id: true, path: true, parentId: true } })
      : null;
    if (input.parentId && !parent) throw new NotFoundError('Родительская папка не найдена');
    if (parent?.parentId) throw new ValidationError('Разрешены только два уровня категорий');
    const duplicate = await tx.category.findFirst({
      where: { parentId: input.parentId, name: { equals: input.name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictError('В этой папке уже есть категория с таким названием');
    const id = randomUUID();
    return tx.category.create({
      data: { id, name: input.name, parentId: input.parentId,
        path: parent ? parent.path + parent.id + '/' : '/',
        // Независимый от названия служебный slug, пока нет настройки адресов витрины.
        slug: 'category-' + id },
      select: categorySelect,
    });
  });
}

export async function renameCategory(id: string, name: string) {
  return changeCategory(async (tx) => {
    const before = await tx.category.findUnique({ where: { id }, select: categorySelect });
    if (!before) throw new NotFoundError('Категория не найдена');
    const duplicate = await tx.category.findFirst({
      where: { id: { not: id }, parentId: before.parentId, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictError('В этой папке уже есть категория с таким названием');
    const after = before.name === name ? before : await tx.category.update({
      where: { id }, data: { name }, select: categorySelect,
    });
    return { before, after };
  });
}

/**
 * Порядок папок одного уровня.
 *
 * Принимается весь список детей родителя: частичный отклоняем. Иначе
 * «переставить две» и «удалить одну параллельно» дают дерево, в котором
 * половина уровня имеет новый порядок, а половина старый, и по данным уже
 * не понять, что человек имел в виду.
 */
export async function reorderCategories(input: ReorderCategoriesInput) {
  return changeCategory(async (tx) => {
    const current = await tx.category.findMany({
      where: { parentId: input.parentId },
      select: { id: true, sortOrder: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    });

    if (current.length !== input.ids.length
      || !input.ids.every((id) => current.some((row) => row.id === id))) {
      throw new ConflictError('Категории изменились. Обновите страницу и повторите');
    }

    // Пишем только то, что реально съехало: лишние update раздувают журнал БД
    // и мешают увидеть в логе настоящее изменение.
    const changed = input.ids.filter((id, index) =>
      current.find((row) => row.id === id)?.sortOrder !== index);

    for (const [index, id] of input.ids.entries()) {
      if (!changed.includes(id)) continue;
      await tx.category.update({ where: { id }, data: { sortOrder: index } });
    }

    return { updated: changed.length, before: current.map((row) => row.id), after: input.ids };
  });
}

export async function deleteCategory(id: string): Promise<CategoryDto> {
  return prisma.$transaction(async (tx) => {
    // Блокируем родительскую запись ДО проверки пустоты. Новые ссылки из товаров
    // и подпапок ждут этот lock: SetNull не должен молча отвязать добавленный товар.
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Category" WHERE id = ${id}::uuid FOR UPDATE`;
    if (!locked.length) throw new NotFoundError('Категория не найдена');
    const category = await tx.category.findUniqueOrThrow({ where: { id }, select: categorySelect });
    const children = await tx.category.count({ where: { parentId: id } });
    const products = await tx.product.count({ where: { categoryId: id } });
    if (children || products) throw new ConflictError('Сначала переместите товары и удалите подпапки');
    await tx.category.delete({ where: { id } });
    return category;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}
