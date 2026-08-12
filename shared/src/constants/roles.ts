/**
 * Роли пользователей. Единственное место, где они объявлены:
 * server проверяет по ним доступ, front по ним рисует интерфейс.
 */
export const USER_ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  CLIENT: 'CLIENT',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

/**
 * Статус учётной записи. Пока админ не подтвердил регистрацию,
 * пользователь остаётся в PENDING и внутрь не проходит.
 */
export const USER_STATUSES = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  REJECTED: 'REJECTED',
  BLOCKED: 'BLOCKED',
} as const;

export type UserStatus = (typeof USER_STATUSES)[keyof typeof USER_STATUSES];
