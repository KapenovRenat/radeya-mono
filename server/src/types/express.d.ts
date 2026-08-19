import type { AuthUser } from '@radeya/shared';

/**
 * Расширение типов Express: requireAuth кладёт сюда текущего пользователя,
 * дальше он доступен в любом контроллере без приведения типов.
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionId?: string;
    }
  }
}

export {};
