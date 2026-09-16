import type { CabinetOffer } from './kaspi-cabinet';

/**
 * Каталог: контракты сохранения товаров из кабинета Kaspi.
 *
 * Сохранение — отдельное действие, а не часть загрузки: человек сначала
 * смотрит таблицу, и только потом решает писать в базу.
 */

/** Тело POST /api/products/import-kaspi: товары ровно в том виде, в каком их показали. */
export interface ImportKaspiProductsRequest {
  offers: CabinetOffer[];
}

/** Товар, который не удалось сохранить, и почему. */
export interface ImportProductFailure {
  sku: string;
  reason: string;
}

export interface ImportKaspiProductsResponse {
  /** Товаров не было в базе — завели. */
  created: number;
  /** Артикул уже есть: наши поля не трогаем, запись пропущена целиком. */
  skipped: number;
  /** Не сохранились. Импорт из-за них не отменяется. */
  failed: ImportProductFailure[];
  /**
   * Коды складов, которых нет в справочнике. Остатки по ним не записаны:
   * сначала «Сохранить склады», потом товары.
   */
  missingWarehouses: string[];
}

/** Ответ GET /api/products/skus — артикулы, которые уже лежат в базе. */
export interface KnownSkusResponse {
  skus: string[];
}
