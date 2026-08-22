import type { UserRole } from '../constants/roles';

/** Сотрудник в списке. Явный набор полей — `passwordHash` наружу не уходит никогда. */
export interface UserListItem {
  id: string;
  login: string;
  name: string;
  position: string;
  role: UserRole;
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
  role: UserRole;
}
