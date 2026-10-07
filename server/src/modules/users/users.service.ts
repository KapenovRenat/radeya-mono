import {
  USER_ROLES,
  normalizePermissions,
  type AuthUser,
  type Permission,
  type UserListItem,
} from '@radeya/shared';

import { prisma } from '../../db/client';
import type { Prisma, User } from '../../generated/prisma/client';
import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { hashPassword } from '../auth/auth.service';
import type { CreateUserInput, UpdateUserInput } from './users.schemas';

/**
 * Сотрудники и их права.
 *
 * Права раздаёт админ или сотрудник с правом USERS_MANAGE. Второму — с
 * ограничениями, иначе это готовый способ стать админом:
 * - выдаёт и снимает только те права, что есть у него самого;
 * - не трогает админов и не делает никого админом;
 * - не меняет роль и права самому себе.
 * Админ ограничен только защитой от потери системы: нельзя удалить себя
 * и нельзя оставить систему без единого админа.
 */

/** DTO наружу. Модель из базы отдавать нельзя — в ней `passwordHash`. */
export function toUserListItem(user: User): UserListItem {
  return {
    id: user.id,
    login: user.login,
    name: user.name,
    position: user.position,
    role: user.role,
    permissions: normalizePermissions(user.permissions),
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
export async function createUser(input: CreateUserInput, actor: AuthUser): Promise<User> {
  assertCanAssignRole(actor, input.role);
  assertCanChangePermissions(actor, [], input.permissions);

  try {
    return await prisma.user.create({
      data: {
        login: input.login,
        name: input.name,
        position: input.position,
        role: input.role,
        permissions: input.permissions,
        passwordHash: await hashPassword(input.password),
        createdById: actor.id,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(`Логин «${input.login}» уже занят`);
    }

    throw error;
  }
}

/**
 * Правка карточки: имя, должность, роль, права, при желании новый пароль.
 * Новый пароль гасит все сессии сотрудника — старый мог утечь, ради этого
 * его обычно и меняют. Права и роль действуют сразу и без этого: они
 * читаются из базы на каждом запросе.
 */
export async function updateUser(
  id: string,
  input: UpdateUserInput,
  actor: AuthUser,
): Promise<{ before: User; after: User }> {
  return prisma.$transaction(async (tx) => {
    const before = await lockUser(tx, id);
    const isSelf = before.id === actor.id;
    const roleChanged = before.role !== input.role;
    const permissionsChanged = !samePermissions(before.permissions, input.permissions);

    assertCanManage(actor, before);

    if (isSelf && (roleChanged || permissionsChanged)) {
      throw new ForbiddenError('Свою роль и права меняет другой сотрудник с доступом к правам');
    }

    if (roleChanged) {
      assertCanAssignRole(actor, input.role);
      if (before.role === USER_ROLES.ADMIN) await assertNotLastAdmin(tx, before.id);
    }

    assertCanChangePermissions(actor, before.permissions, input.permissions);

    const after = await tx.user.update({
      where: { id },
      data: {
        name: input.name,
        position: input.position,
        role: input.role,
        permissions: input.permissions,
        ...(input.password !== undefined ? { passwordHash: await hashPassword(input.password) } : {}),
      },
    });

    if (input.password !== undefined) await tx.session.deleteMany({ where: { userId: id } });

    return { before, after };
  });
}

/**
 * Удаление насовсем — решение пользователя 07.10.2026. Сессии уходят вместе
 * с сотрудником; его комментарии, заказы и документы склада остаются без
 * автора (SetNull), журнал действий хранит логин снимком.
 */
export async function deleteUser(id: string, actor: AuthUser): Promise<User> {
  return prisma.$transaction(async (tx) => {
    const user = await lockUser(tx, id);

    if (user.id === actor.id) throw new ForbiddenError('Нельзя удалить самого себя');

    assertCanManage(actor, user);
    if (user.role === USER_ROLES.ADMIN) await assertNotLastAdmin(tx, user.id);

    await tx.user.delete({ where: { id } });

    return user;
  });
}

/**
 * Сотрудник под блокировкой строки — вместе со всеми админами, в порядке id.
 * Две правки одной карточки не перетрут друг друга, а двое админов, удаляющие
 * друг друга одновременно, встанут в очередь: второй увидит, что админ
 * остался один (assertNotLastAdmin). Один порядок блокировок — без взаимной.
 */
async function lockUser(tx: Prisma.TransactionClient, id: string): Promise<User> {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "User" WHERE "id" = ${id}::uuid OR "role" = 'ADMIN' ORDER BY "id" FOR UPDATE`;

  if (!locked.some((row) => row.id === id)) throw new NotFoundError('Сотрудник не найден');

  return tx.user.findUniqueOrThrow({ where: { id } });
}

/** Админа меняет и удаляет только админ. */
function assertCanManage(actor: AuthUser, target: User): void {
  if (target.role === USER_ROLES.ADMIN && actor.role !== USER_ROLES.ADMIN) {
    throw new ForbiddenError('Админа может менять только админ');
  }
}

/** Сделать админом может только админ: у админа нет ограничений вовсе. */
function assertCanAssignRole(actor: AuthUser, role: User['role']): void {
  if (role === USER_ROLES.ADMIN && actor.role !== USER_ROLES.ADMIN) {
    throw new ForbiddenError('Назначить админа может только админ');
  }
}

/**
 * Не админ выдаёт и снимает только те права, что есть у него самого.
 * Иначе сотрудник с доступом к правам выдал бы кому угодно — и через
 * сообщника себе — всё остальное.
 */
function assertCanChangePermissions(actor: AuthUser, before: readonly string[], after: readonly Permission[]): void {
  if (actor.role === USER_ROLES.ADMIN) return;

  const own = new Set<string>(actor.permissions);
  const was = new Set(normalizePermissions(before));
  const changed = [
    ...after.filter((permission) => !was.has(permission)),
    ...[...was].filter((permission) => !after.includes(permission)),
  ];
  const foreign = changed.filter((permission) => !own.has(permission));

  if (foreign.length > 0) {
    throw new ForbiddenError('Выдавать и снимать можно только те права, что есть у вас самих');
  }
}

/** Систему нельзя оставить без админа: вернуть доступ было бы некому, кроме как из терминала. */
/** Админы уже заблокированы в lockUser — счёт не изменится до конца транзакции. */
async function assertNotLastAdmin(tx: Prisma.TransactionClient, leavingId: string): Promise<void> {
  const others = await tx.user.count({
    where: { role: USER_ROLES.ADMIN, isActive: true, id: { not: leavingId } },
  });

  if (others === 0) throw new ConflictError('Это последний админ — сначала назначьте другого');
}

function samePermissions(before: readonly string[], after: readonly Permission[]): boolean {
  const normalized = normalizePermissions(before);

  return normalized.length === after.length && normalized.every((permission, index) => permission === after[index]);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}
