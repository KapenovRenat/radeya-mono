/**
 * Действия, попадающие в журнал. Именованные константы, а не строки по месту
 * вызова: опечатка в строке молча создаст новый вид действия, и фильтр по журналу
 * его не найдёт.
 *
 * Набор дополняется по мере появления разделов.
 */
export const AUDIT_ACTIONS = {
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGIN_FAILED: 'USER_LOGIN_FAILED',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_CREATED: 'USER_CREATED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  KASPI_CATALOG_PREVIEW: 'KASPI_CATALOG_PREVIEW',
  KASPI_WAREHOUSES_SAVED: 'KASPI_WAREHOUSES_SAVED',
  KASPI_CABINET_FETCH: 'KASPI_CABINET_FETCH',
  KASPI_PRODUCTS_IMPORTED: 'KASPI_PRODUCTS_IMPORTED',
  CATEGORY_CREATED: 'CATEGORY_CREATED',
  CATEGORY_RENAMED: 'CATEGORY_RENAMED',
  CATEGORY_DELETED: 'CATEGORY_DELETED',
  PRODUCTS_CATEGORY_CHANGED: 'PRODUCTS_CATEGORY_CHANGED',
  PRODUCTS_RENAMED: 'PRODUCTS_RENAMED',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/** Подписи действий для журнала в интерфейсе. */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  USER_LOGIN: 'Вход в систему',
  USER_LOGIN_FAILED: 'Неудачная попытка входа',
  USER_LOGOUT: 'Выход из системы',
  USER_CREATED: 'Создан сотрудник',
  USER_ROLE_CHANGED: 'Изменена роль',
  USER_DEACTIVATED: 'Сотрудник отключён',
  KASPI_CATALOG_PREVIEW: 'Синхронизация с Kaspi (предпросмотр)',
  KASPI_WAREHOUSES_SAVED: 'Сохранены склады из выгрузки Kaspi',
  KASPI_CABINET_FETCH: 'Загрузка каталога из кабинета Kaspi',
  KASPI_PRODUCTS_IMPORTED: 'Сохранены товары из кабинета Kaspi',
  CATEGORY_CREATED: 'Создана категория товаров',
  CATEGORY_RENAMED: 'Категория переименована',
  CATEGORY_DELETED: 'Категория удалена',
  PRODUCTS_CATEGORY_CHANGED: 'Товары перемещены в категорию',
  PRODUCTS_RENAMED: 'Товары переименованы пачкой',
};
