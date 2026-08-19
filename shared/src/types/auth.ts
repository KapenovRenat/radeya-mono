import type { UserRole } from '../constants/roles';

/**
 * Контракты входа. Одна и та же форма на сервере и на фронте:
 * сервер отдаёт именно это, фронт именно это и ждёт.
 */

/** Тело POST /api/auth/login. */
export interface LoginRequest {
  login: string;
  password: string;
}

/**
 * Сотрудник в том виде, в каком он уходит наружу.
 * Явный набор полей, а не модель из базы: `passwordHash` не должен
 * попасть в ответ даже случайно.
 */
export interface AuthUser {
  id: string;
  login: string;
  name: string;
  position: string;
  role: UserRole;
}

/** Ответ POST /api/auth/login и GET /api/auth/me. */
export interface AuthResponse {
  user: AuthUser;
}
