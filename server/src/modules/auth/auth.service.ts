import { hash, verify } from '@node-rs/argon2';
import type { AuthUser } from '@radeya/shared';

import { prisma } from '../../db/client';
import { UnauthorizedError } from '../../lib/errors';
import { SESSION_TTL_MS } from '../../config/session';
import type { User } from '../../generated/prisma/client';

/**
 * Хеш заведомо несуществующего пароля. Нужен, чтобы при неизвестном логине
 * потратить столько же времени, сколько на реальную проверку: иначе по скорости
 * ответа можно перебрать, какие логины существуют.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2E$YQq3Zx0DqQKX8y3f5cVpVYQ0uZ8xN0mEwXk1kQwqE6E';

export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

/** Явный набор полей наружу. Модель из базы отдавать нельзя — там `passwordHash`. */
export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    login: user.login,
    name: user.name,
    position: user.position,
    role: user.role,
  };
}

/**
 * Проверка пары логин-пароль.
 *
 * Все отказы — с одним и тем же текстом и кодом. Разделять «нет такого логина»
 * и «неверный пароль» нельзя: это готовая подсказка для перебора учётных записей.
 */
export async function authenticate(
  login: string,
  password: string,
): Promise<User> {
  const user = await prisma.user.findUnique({ where: { login } });

  if (!user) {
    await verify(DUMMY_HASH, password).catch(() => false);
    throw new UnauthorizedError('Неверный логин или пароль');
  }

  const passwordMatches = await verify(user.passwordHash, password).catch(
    () => false,
  );

  if (!passwordMatches || !user.isActive) {
    throw new UnauthorizedError('Неверный логин или пароль');
  }

  return user;
}

export async function createSession(
  userId: string,
  userAgent: string | null,
  ip: string | null,
) {
  return prisma.session.create({
    data: {
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      userAgent,
      ip,
    },
  });
}

/**
 * Действующая сессия вместе с пользователем.
 *
 * Проверяем и срок, и активность учётной записи: отключили сотрудника —
 * его открытая вкладка перестаёт работать на следующем же запросе.
 */
export async function findActiveSession(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await destroySession(session.id);
    return null;
  }

  if (!session.user.isActive) return null;

  return session;
}

export async function destroySession(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

/** Все сессии пользователя — при смене пароля и при отключении сотрудника. */
export async function destroyUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
