/** Настройки серверного каталога; локальная таблица импорта имеет свою пагинацию. */
export const CATALOG_PAGE_SIZES = [10, 20, 50] as const;
export const CATALOG_DEFAULT_PAGE_SIZE = 20;
export const CATALOG_SEARCH_MAX_LENGTH = 200;
export const CATEGORY_NAME_MAX_LENGTH = 150;
export const ALL_PRODUCTS_LABEL = 'Все товары';
export const CATALOG_MOVE_MAX_PRODUCTS = 100;
export type CatalogPageSize = (typeof CATALOG_PAGE_SIZES)[number];
