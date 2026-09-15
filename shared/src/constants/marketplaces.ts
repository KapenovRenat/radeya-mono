/**
 * Торговые площадки. Отдельное перечисление, а не колонки в таблице товара:
 * четвёртая площадка должна добавляться сюда одной строкой, а не миграцией
 * и правкой всех запросов, где площадки перечислены поимённо.
 */
export const MARKETPLACES = {
  KASPI: 'KASPI',
  OZON: 'OZON',
  WB: 'WB',
} as const;

export type Marketplace = (typeof MARKETPLACES)[keyof typeof MARKETPLACES];

export const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  KASPI: 'Kaspi',
  OZON: 'OZON',
  WB: 'Wildberries',
};

/** Статус размещения на площадке. Принадлежит паре «товар × площадка», а не товару. */
export const LISTING_STATUSES = {
  ON_SALE: 'ON_SALE',
  OFF_SALE: 'OFF_SALE',
} as const;

export type ListingStatus =
  (typeof LISTING_STATUSES)[keyof typeof LISTING_STATUSES];

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  ON_SALE: 'В продаже',
  OFF_SALE: 'Снят с продажи',
};
