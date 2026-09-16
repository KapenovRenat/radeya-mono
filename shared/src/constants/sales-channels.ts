/**
 * Каналы продаж. Отдельное перечисление, а не колонки в таблице товара:
 * новый канал должен добавляться сюда одной строкой, а не миграцией и правкой
 * всех запросов, где каналы перечислены поимённо.
 *
 * Сайт стоит в одном ряду с площадками намеренно: цена у него своя, как и
 * у Kaspi, и витрина читается тем же кодом, что и выгрузка на площадку.
 * WB убран по решению от 16.09.2026 — вернуть его будет одной строкой.
 */
export const SALES_CHANNELS = {
  SITE: 'SITE',
  KASPI: 'KASPI',
  OZON: 'OZON',
} as const;

export type SalesChannel = (typeof SALES_CHANNELS)[keyof typeof SALES_CHANNELS];

export const SALES_CHANNEL_LABELS: Record<SalesChannel, string> = {
  SITE: 'Сайт',
  KASPI: 'Kaspi',
  OZON: 'OZON',
};

/** Статус размещения на канале. Принадлежит паре «товар × канал», а не товару. */
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
