import type { RequestHandler } from 'express';
import { AUDIT_ACTIONS } from '@radeya/shared';

import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../../config/session';
import { UnauthorizedError, ValidationError } from '../../lib/errors';
import { clientIp, logAction } from '../../lib/audit';
import { loginSchema } from './auth.schemas';
import {
  authenticate,
  createSession,
  destroySession,
  toAuthUser,
} from './auth.service';

/** POST /api/auth/login */
export const login: RequestHandler = async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    // Подробности не раскрываем: по ним видно, какой из двух полей не подошло.
    throw new ValidationError('Неверный логин или пароль');
  }

  const ip = clientIp(req);
  const userAgent = req.get('user-agent') ?? null;

  try {
    const user = await authenticate(parsed.data.login, parsed.data.password);
    const session = await createSession(user.id, userAgent, ip);

    res.cookie(SESSION_COOKIE_NAME, session.id, sessionCookieOptions);

    await logAction({
      userId: user.id,
      userLogin: user.login,
      userRole: user.role,
      action: AUDIT_ACTIONS.USER_LOGIN,
      ip,
    });

    res.json({ user: toAuthUser(user) });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      // Неудачные попытки пишем тоже: иначе подбор пароля не увидеть.
      await logAction({
        userLogin: parsed.data.login,
        userRole: '—',
        action: AUDIT_ACTIONS.USER_LOGIN_FAILED,
        ip,
      });
    }

    throw error;
  }
};

/** POST /api/auth/logout */
export const logout: RequestHandler = async (req, res) => {
  if (req.sessionId && req.user) {
    await destroySession(req.sessionId);

    await logAction({
      userId: req.user.id,
      userLogin: req.user.login,
      userRole: req.user.role,
      action: AUDIT_ACTIONS.USER_LOGOUT,
      ip: clientIp(req),
    });
  }

  // maxAge при удалении не нужен, остальные поля обязаны совпадать с установкой.
  const { maxAge: _maxAge, ...clearOptions } = sessionCookieOptions;
  res.clearCookie(SESSION_COOKIE_NAME, clearOptions);

  res.status(204).end();
};

/** GET /api/auth/me */
export const me: RequestHandler = (req, res) => {
  res.json({ user: req.user });
};
