import { USER_ROLES, type UserRole } from './roles';

/**
 * Кто видит деньги в каталоге. Одна константа на сервер и фронт: сервер без
 * этой роли отдаёт поле пустым, фронт прячет столбец. Спрятать только
 * на фронте мало — данные всё равно приходили бы в ответе.
 */
export const CATALOG_PURCHASE_ROLES: readonly UserRole[] = [USER_ROLES.ADMIN];
export const CATALOG_COST_ROLES: readonly UserRole[] = [USER_ROLES.ADMIN];

/**
 * Название товара для показа: карточка Kaspi, иначе наше название модели.
 *
 * Одно правило на каталог и окно заказа. Название модели у сотен товаров —
 * тип изделия («диван»), поэтому первым идёт полное название с витрины.
 */
export function variantDisplayName(masterTitle: string | null, name: string): string {
  return masterTitle ?? name;
}

/** Настройки серверного каталога; локальная таблица импорта имеет свою пагинацию. */
export const CATALOG_PAGE_SIZES = [10, 20, 50] as const;
export const CATALOG_DEFAULT_PAGE_SIZE = 20;
export const CATALOG_SEARCH_MAX_LENGTH = 200;
export const CATEGORY_NAME_MAX_LENGTH = 150;
export const ALL_PRODUCTS_LABEL = 'Все товары';
export const CATALOG_MOVE_MAX_PRODUCTS = 100;
export type CatalogPageSize = (typeof CATALOG_PAGE_SIZES)[number];

/**
 * Колонки, по которым сортируется каталог. Закрытый список: на сервере каждому
 * ключу соответствует готовый кусок SQL, и имя колонки из запроса в SQL
 * не попадает никогда.
 *
 * Цифры склада (остаток, резерв, ожидание, доступно) — сумма по складам,
 * а при фильтре по складам — только по выбранным. Предзаказ — максимальный
 * срок, дни на складе — среднее, взвешенное по остатку.
 *
 * Закупка сортируется по числу, без учёта валюты — решение пользователя.
 */
export const CATALOG_SORT_KEYS = {
  PRICE: 'price',
  PURCHASE_PRICE: 'purchasePrice',
  QUANTITY: 'quantity',
  RESERVED: 'reserved',
  EXPECTED: 'expected',
  AVAILABLE: 'available',
  PRE_ORDER_DAYS: 'preOrderDays',
  DAYS_ON_STOCK: 'daysOnStock',
} as const;

export type CatalogSortKey = (typeof CATALOG_SORT_KEYS)[keyof typeof CATALOG_SORT_KEYS];

export const SORT_ORDERS = { ASC: 'asc', DESC: 'desc' } as const;

export type SortOrder = (typeof SORT_ORDERS)[keyof typeof SORT_ORDERS];

/**
 * Значение фильтра поставщиков «без поставщика». Строкой, а не null:
 * список идёт в адрес запроса, а null там не передать.
 */
export const CATALOG_NO_SUPPLIER = 'none';

/** Сколько значений принимает один фильтр списка: складов и поставщиков десятки. */
export const CATALOG_FILTER_MAX_VALUES = 100;
