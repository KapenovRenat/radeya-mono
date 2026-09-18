import { randomUUID } from 'node:crypto';
import { ALL_PRODUCTS_LABEL, type CategoryDto, type CategoryTreeNode,
  type CategoryTreeResponse } from '@radeya/shared';
import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../db/client';
import { ConflictError, NotFoundError } from '../../lib/errors';
import type { CreateCategoryInput } from './categories.schemas';

const CREATE_ATTEMPTS = 3;
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

export async function createCategory(input: CreateCategoryInput): Promise<CategoryDto> {
  // PostgreSQL допускает дубликаты (NULL, name) в обычном unique.
  // Serializable защищает проверку также для корневых папок и параллельных запросов.
  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const parent = input.parentId
          ? await tx.category.findUnique({ where: { id: input.parentId },
              select: { id: true, path: true } })
          : null;
        if (input.parentId && !parent) throw new NotFoundError('Родительская папка не найдена');
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
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2034' && attempt + 1 < CREATE_ATTEMPTS) continue;
        if (error.code === 'P2002') throw new ConflictError('Такая категория уже существует');
        if (error.code === 'P2034') throw new ConflictError('Категории изменились. Повторите создание');
      }
      throw error;
    }
  }
  throw new ConflictError('Повторите создание категории');
}
