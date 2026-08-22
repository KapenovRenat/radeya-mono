import type { UserListItem } from '@radeya/shared';

import { prisma } from '../../db/client';
import { ConflictError } from '../../lib/errors';
import { hashPassword } from '../auth/auth.service';
import type { CreateUserInput } from './users.schemas';
import type { User } from '../../generated/prisma/client';

/** DTO наружу. Модель из базы отдавать нельзя — в ней `passwordHash`. */
export function toUserListItem(user: User): UserListItem {
  return {
    id: user.id,
    login: user.login,
    name: user.name,
    position: user.position,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Список сотрудников. Свежие сверху — их чаще всего и ищут после создания. */
export async function listUsers(): Promise<UserListItem[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return users.map(toUserListItem);
}

/**
 * Создание сотрудника.
 *
 * Уникальность логина проверяет база — своей предварительной проверкой
 * гонку не закрыть: два одновременных запроса пройдут её оба.
 * Поэтому ловим ошибку уникального индекса и переводим её в 409.
 */
export async function createUser(
  input: CreateUserInput,
  createdById: string,
): Promise<User> {
  try {
    return await prisma.user.create({
      data: {
        login: input.login,
        name: input.name,
        position: input.position,
        role: input.role,
        passwordHash: await hashPassword(input.password),
        createdById,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(`Логин «${input.login}» уже занят`);
    }

    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}
