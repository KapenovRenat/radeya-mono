/**
 * Роли сотрудников. С 07.10.2026 доступ решают не роли, а права-галочки
 * (constants/permissions.ts): роль — шаблон галочек, и только ADMIN
 * особенный — ему можно всё.
 * Значения обязаны совпадать с enum UserRole в server/prisma/schema.prisma.
 *
 * Клиенты магазина ролей не имеют — это отдельная сущность Customer
 * со своим входом, см. docs/data-model.md.
 */
export const USER_ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  SELLER: 'SELLER',
  VIEWER: 'VIEWER'
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

/**
 * Подпись вместо автора, когда сотрудника удалили: комментарии, заказы
 * и документы остаются, связь с ним пустеет.
 */
export const DELETED_USER_NAME = 'Удалённый сотрудник';

/** Подписи ролей для интерфейса. Держим рядом с ролями, чтобы не разъезжались. */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Админ',
  MANAGER: 'Менеджер',
  SELLER: 'Продавец',
  VIEWER: 'Смотрящий'
};
