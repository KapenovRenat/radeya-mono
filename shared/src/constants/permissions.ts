import { USER_ROLES, type UserRole } from './roles';

/**
 * Права сотрудников — галочки в карточке сотрудника. Решение пользователя
 * от 07.10.2026: доступ решают галочки, роль — только шаблон галочек.
 *
 * ── Как добавить новое право ────────────────────────────────────────────
 * 1. Ключ в PERMISSIONS и подпись с группой в PERMISSION_INFO (TypeScript
 *    не соберёт проект, пока подписи нет).
 * 2. Проверка на сервере у маршрута: `can(PERMISSIONS.X)`, или в коде:
 *    `hasPermission(req.user, PERMISSIONS.X)`.
 * 3. Тот же ключ на фронте: `can(PERMISSIONS.X)` из `useCan()` — спрятать
 *    кнопку или колонку. Это удобство, защита — проверка на сервере.
 * 4. Если право нужно ролям по умолчанию — добавить его в ROLE_PERMISSION_TEMPLATES.
 *
 * Миграция базы не нужна: у сотрудника права лежат массивом строк, а новое
 * право у всех просто снято, пока его не поставят.
 *
 * Ключ, однажды выданный сотрудникам, не переименовывать: у них в базе
 * лежит старый ключ, и право молча пропадёт. Удалённое из списка право
 * сервер просто перестаёт видеть.
 *
 * Админ (роль ADMIN) может всё без галочек — см. hasPermission().
 */
export const PERMISSIONS = {
  STATS_VIEW: 'STATS_VIEW',
  STATS_MONEY: 'STATS_MONEY',

  ORDERS_VIEW: 'ORDERS_VIEW',
  ORDERS_COMMENT: 'ORDERS_COMMENT',
  ORDERS_SYNC: 'ORDERS_SYNC',
  ORDERS_CREATE_OFFLINE: 'ORDERS_CREATE_OFFLINE',
  ORDERS_KASPI_DEBUG: 'ORDERS_KASPI_DEBUG',

  CATALOG_VIEW: 'CATALOG_VIEW',
  CATALOG_VIEW_PURCHASE: 'CATALOG_VIEW_PURCHASE',
  CATALOG_VIEW_COST: 'CATALOG_VIEW_COST',
  CATALOG_EDIT_FOLDERS: 'CATALOG_EDIT_FOLDERS',

  STOCK_DOCUMENTS_VIEW: 'STOCK_DOCUMENTS_VIEW',
  STOCK_DOCUMENTS_EDIT: 'STOCK_DOCUMENTS_EDIT',
  STOCK_DOCUMENTS_POST: 'STOCK_DOCUMENTS_POST',
  WAREHOUSES_MANAGE: 'WAREHOUSES_MANAGE',

  DICTIONARIES_EDIT: 'DICTIONARIES_EDIT',
  SALES_POINTS_MANAGE: 'SALES_POINTS_MANAGE',
  SUPPLIERS_EDIT: 'SUPPLIERS_EDIT',

  IMPORTS: 'IMPORTS',
  KASPI_SYNC: 'KASPI_SYNC',
  KASPI_CABINET_MANAGE: 'KASPI_CABINET_MANAGE',
  WORKERS_MANAGE: 'WORKERS_MANAGE',

  USERS_MANAGE: 'USERS_MANAGE',
  AUDIT_VIEW: 'AUDIT_VIEW',
  USERS_CREATE: 'USERS_CREATE',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Группы — разделы формы с галочками. Порядок здесь — порядок в форме. */
export const PERMISSION_GROUPS = [
  'Статистика',
  'Заказы',
  'Товары',
  'Склад',
  'Справочники',
  'Импорты и Kaspi',
  'Сотрудники и журнал',
  'Аккаунты',
] as const;

export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

export interface PermissionInfo {
  label: string;
  group: PermissionGroup;
  /** Пояснение под галочкой: что именно откроется. */
  hint?: string;
}

export const PERMISSION_INFO: Record<Permission, PermissionInfo> = {
  STATS_VIEW: { label: 'Видеть статистику', group: 'Статистика', hint: 'Главная страница дашборда' },

  ORDERS_VIEW: { label: 'Видеть заказы', group: 'Заказы', hint: 'Раздел «Заказы» и окно заказа' },
  ORDERS_COMMENT: { label: 'Писать комментарии к заказам', group: 'Заказы' },
  ORDERS_SYNC: { label: 'Синхронизировать заказы с Kaspi', group: 'Заказы' },
  ORDERS_CREATE_OFFLINE: { label: 'Создавать офлайн-заказы', group: 'Заказы', hint: 'Экран ввода заказа ещё в работе' },
  ORDERS_KASPI_DEBUG: { label: 'Отладка заказов Kaspi', group: 'Заказы', hint: 'Сырые ответы Kaspi в консоли' },

  CATALOG_VIEW: { label: 'Видеть товары', group: 'Товары', hint: 'Раздел «Товары» и дерево папок' },
  CATALOG_VIEW_PURCHASE: { label: 'Видеть закупку', group: 'Товары' },
  CATALOG_VIEW_COST: { label: 'Видеть себестоимость', group: 'Товары' },
  CATALOG_EDIT_FOLDERS: { label: 'Папки и перенос товаров', group: 'Товары' },

  STOCK_DOCUMENTS_VIEW: { label: 'Видеть документы склада', group: 'Склад', hint: 'В документах видна себестоимость' },
  STOCK_DOCUMENTS_EDIT: { label: 'Создавать и править черновики', group: 'Склад' },
  STOCK_DOCUMENTS_POST: { label: 'Проводить документы', group: 'Склад', hint: 'Галочка «Проведено» — меняет остатки' },
  WAREHOUSES_MANAGE: { label: 'Склады', group: 'Склад', hint: 'Свои склады, Telegram-группы складов' },

  DICTIONARIES_EDIT: { label: 'Пополняемые списки', group: 'Справочники', hint: 'Статус доставки, оплата и т.п.' },
  SALES_POINTS_MANAGE: { label: 'Точки продаж', group: 'Справочники' },
  SUPPLIERS_EDIT: { label: 'Поставщики', group: 'Справочники', hint: 'Карточка и Telegram ID' },

  IMPORTS: { label: 'Импорты', group: 'Импорты и Kaspi', hint: 'Продажи из Excel, МойСклад' },
  KASPI_SYNC: { label: 'Синхронизация товаров и складов Kaspi', group: 'Импорты и Kaspi' },
  KASPI_CABINET_MANAGE: { label: 'Кабинет Kaspi', group: 'Импорты и Kaspi', hint: 'Email и пароль от кабинета' },
  WORKERS_MANAGE: { label: 'Воркеры', group: 'Импорты и Kaspi', hint: 'Настройки, отправка в Telegram, история' },

  USERS_MANAGE: {
    label: 'Сотрудники и права',
    group: 'Сотрудники и журнал',
    hint: 'Может выдавать только те права, что есть у него самого, и не трогает админов',
  },
  AUDIT_VIEW: { label: 'Журнал действий', group: 'Сотрудники и журнал' },
  USERS_CREATE: { label: 'Создание аккаунтов', group: 'Аккаунты' },
  STATS_MONEY: { label: 'Видеть статистику по выручке', group: 'Статистика' },
};

/** Все права в порядке объявления — так их рисует форма. */
export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

const {
  STATS_VIEW, ORDERS_VIEW, ORDERS_COMMENT, ORDERS_SYNC, ORDERS_CREATE_OFFLINE,
  CATALOG_VIEW, CATALOG_EDIT_FOLDERS, STOCK_DOCUMENTS_VIEW, STOCK_DOCUMENTS_EDIT,
  DICTIONARIES_EDIT,
} = PERMISSIONS;

/**
 * Шаблоны: что проставляется галочками при выборе роли в форме. Повторяют
 * доступ ролей до перехода на права (01.10.2026) — после миграции ни у кого
 * ничего не пропало и не появилось. Админу шаблон не нужен: ему можно всё.
 */
export const ROLE_PERMISSION_TEMPLATES: Record<UserRole, readonly Permission[]> = {
  ADMIN: ALL_PERMISSIONS,
  MANAGER: [STATS_VIEW, ORDERS_VIEW, ORDERS_COMMENT, ORDERS_SYNC, ORDERS_CREATE_OFFLINE,
    CATALOG_VIEW, CATALOG_EDIT_FOLDERS, STOCK_DOCUMENTS_VIEW, STOCK_DOCUMENTS_EDIT, DICTIONARIES_EDIT],
  SELLER: [STATS_VIEW, ORDERS_VIEW, ORDERS_COMMENT, ORDERS_CREATE_OFFLINE, CATALOG_VIEW],
  VIEWER: [STATS_VIEW, ORDERS_VIEW, ORDERS_COMMENT, CATALOG_VIEW],
  DEVELOPER: ALL_PERMISSIONS,
};

/** Кто проверяется: сотрудник с ролью и выданными правами. */
export interface PermissionHolder {
  role: UserRole;
  permissions: readonly string[];
}

/**
 * Есть ли у сотрудника право. Одна проверка на сервер и фронт.
 *
 * - Админ может всё: иначе каждое новое право пришлось бы выдавать и себе,
 *   а снять с себя «Сотрудники и права» значило бы потерять систему.
 * - Право не указано — достаточно войти (справочники, свой профиль).
 */
export function hasPermission(holder: PermissionHolder | null | undefined, permission?: Permission): boolean {
  if (!holder) return false;
  if (permission === undefined || holder.role === USER_ROLES.ADMIN) return true;

  return holder.permissions.includes(permission);
}

/**
 * Права из базы или запроса — только известные, без повторов, в порядке списка.
 * Удалённое из PERMISSIONS право отбрасывается, а не роняет вход.
 */
export function normalizePermissions(values: readonly string[]): Permission[] {
  const given = new Set(values);

  return ALL_PERMISSIONS.filter((permission) => given.has(permission));
}
