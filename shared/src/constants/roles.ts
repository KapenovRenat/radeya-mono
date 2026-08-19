/**
 * Роли сотрудников в дашборде. Единственное место, где они объявлены:
 * server проверяет по ним доступ, front по ним рисует интерфейс.
 * Значения обязаны совпадать с enum UserRole в server/prisma/schema.prisma.
 *
 * Клиенты магазина ролей не имеют — это отдельная сущность Customer
 * со своим входом, см. docs/data-model.md.
 */
export const USER_ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  SELLER: 'SELLER',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

/** Подписи ролей для интерфейса. Держим рядом с ролями, чтобы не разъезжались. */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Админ',
  MANAGER: 'Менеджер',
  SELLER: 'Продавец',
};
