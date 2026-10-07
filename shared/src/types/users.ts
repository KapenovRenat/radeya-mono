import type { Permission } from '../constants/permissions';
import type { UserRole } from '../constants/roles';

/** Сотрудник в списке. Явный набор полей — `passwordHash` наружу не уходит никогда. */
export interface UserListItem {
  id: string;
  login: string;
  name: string;
  position: string;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  /** ISO-строка: JSON не умеет даты, разбирает уже фронт. */
  createdAt: string;
}

/** Тело POST /api/users. Пароль задаёт админ при создании. */
export interface CreateUserRequest {
  login: string;
  password: string;
  name: string;
  position: string;
  /** Шаблон галочек; доступ решают `permissions`. ADMIN — может всё. */
  role: UserRole;
  permissions: Permission[];
}

/**
 * Тело PATCH /api/users/:id — карточка целиком. Логин не меняется: по нему
 * входят и его видно в журнале. `password` — задать новый; не передан — прежний.
 */
export interface UpdateUserRequest {
  name: string;
  position: string;
  role: UserRole;
  permissions: Permission[];
  password?: string;
}
