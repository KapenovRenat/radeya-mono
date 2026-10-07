import type { RequestHandler } from 'express';
import { hasPermission, type Permission } from '@radeya/shared';

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
  // Уже проверено выше по цепочке (модуль закрыт `router.use(can())`,
  // маршрут уточняет роли) — второй раз в базу не ходим.
  if (req.user) {
    next();
    return;
  }

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
 * Кто может вызвать маршрут — по праву-галочке сотрудника. Ставится у каждого
 * маршрута явно — по строке видно, кому она открыта:
 *
 *   router.get('/', can(), getList);                                // все вошедшие
 *   router.post('/', can(PERMISSIONS.STOCK_DOCUMENTS_EDIT), create);
 *
 * Админ проходит любую проверку (hasPermission). Права читаются из базы
 * на каждом запросе: сняли галочку — закрылось сразу, без повторного входа.
 *
 * Вход проверяет сам. Права всегда проверяются здесь, на сервере: спрятанная
 * кнопка в интерфейсе защитой не является, запрос можно отправить и без неё.
 */
export function can(permission?: Permission): RequestHandler[] {
  return [
    requireAuth,
    (req, _res, next) => {
      if (!req.user) {
        throw new UnauthorizedError();
      }

      if (!hasPermission(req.user, permission)) {
        throw new ForbiddenError();
      }

      next();
    },
  ];
}
