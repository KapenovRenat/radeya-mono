import type { RequestHandler } from 'express';
import type { UserRole } from '@radeya/shared';

import { SESSION_COOKIE_NAME } from '../config/session';
import { ForbiddenError, UnauthorizedError } from '../lib/errors';
import { findActiveSession, toAuthUser } from '../modules/auth/auth.service';

/**
 * Пускает дальше только с действующей сессией и кладёт пользователя в req.
 *
 * Проверка идёт на каждом запросе, а не один раз при входе: роль могли поменять,
 * сотрудника — отключить, сессию — погасить. Кука сама по себе ничего не доказывает.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;

  if (!sessionId) {
    throw new UnauthorizedError();
  }

  const session = await findActiveSession(sessionId);

  if (!session) {
    throw new UnauthorizedError();
  }

  req.user = toAuthUser(session.user);
  req.sessionId = session.id;

  next();
};

/**
 * Ограничение по ролям. Ставится ПОСЛЕ requireAuth — сам он вход не проверяет.
 *
 * Права всегда проверяются здесь, на сервере. Спрятанная кнопка в интерфейсе
 * защитой не является: запрос можно отправить и без неё.
 */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError();
    }

    next();
  };
}
