import type { ListingStatus } from '../constants/sales-channels';

/**
 * Разбор выгрузки каталога Kaspi (ACTIVE.xml и ARCHIVE.xml).
 *
 * Это форма **предпросмотра**: в базу пока ничего не пишется.
 * Поля названы так, чтобы лечь на будущие модели без переделки —
 * см. раздел 10 в docs/kaspi-api-integration.md.
 */

/** Наличие и цена на конкретном складе. В выгрузке это пара availability + cityprice. */
export interface KaspiCatalogStock {
  /** Как в файле: `6871008_PP3`. */
  storeId: string;
  /** Наш код склада: `PP3`. По нему будет связь с моделью Warehouse. */
  warehouseCode: string;
  /** Код города по КАТО. Свойство склада, а не товара. */
  cityId: string | null;
  price: number | null;
  /** Количество в наличии. Пусто, когда товар под заказ. */
  stockCount: number | null;
  /** Срок предзаказа в днях. 0 — товар в наличии. */
  preOrderDays: number;
}

export interface KaspiCatalogOffer {
  /** Артикул. Ключ сопоставления с нашей базой и с позициями заказов. */
  sku: string;
  brand: string | null;
  /** Содержимое <model> как есть — на случай, если разбор названия окажется неверным. */
  rawModel: string;
  /** До первой запятой. */
  name: string;
  /** Всё после первой запятой. */
  subtitle: string | null;
  status: ListingStatus;
  stocks: KaspiCatalogStock[];

  /** Сумма остатков по всем складам. */
  totalStock: number;
  /** Ни на одном складе нет наличия, везде срок предзаказа. */
  isPreOrder: boolean;
  /** Минимальная цена по складам — для колонки в таблице. */
  price: number | null;

  /** Что не удалось разобрать. Пустой массив — запись в порядке. */
  problems: string[];
}

/** Склад, встреченный в выгрузке. Основа для будущего справочника Warehouse. */
export interface KaspiCatalogWarehouse {
  code: string;
  storeId: string;
  cityId: string | null;
  offersCount: number;
}

export interface KaspiCatalogSummary {
  total: number;
  onSale: number;
  offSale: number;
  /** Есть наличие хотя бы на одном складе. */
  inStock: number;
  preOrder: number;
  withProblems: number;
  warehouses: KaspiCatalogWarehouse[];
}

export interface KaspiCatalogPreview {
  offers: KaspiCatalogOffer[];
  summary: KaspiCatalogSummary;
  /** ISO-строка. */
  parsedAt: string;
}

/**
 * Тело POST /api/kaspi-catalog/warehouses: склады из предпросмотра.
 *
 * Отправляем разобранный список, а не XML заново: сохраняется ровно то, что
 * человек увидел на экране, и не гоняем выгрузку по сети второй раз.
 * Сервер всё равно проверяет каждое поле — данные пришли от клиента.
 */
export interface SaveWarehousesRequest {
  warehouses: Array<{
    code: string;
    storeId: string;
    cityId: string | null;
    /**
     * Сколько товаров на складе и какой суммарный остаток — снимок текущей
     * синхронизации. В выгрузке остатка нет, поэтому оба поля необязательны.
     */
    offersCount?: number;
    totalStock?: number;
  }>;
}

/** Итог сохранения справочника складов. */
export interface SaveWarehousesResponse {
  /** Складов не было в базе — завели. */
  created: number;
  /** Нашлись по коду, изменился storeId или город. */
  updated: number;
  /** Нашлись, менять нечего. */
  unchanged: number;
}

/** Склад из справочника. Отличается от KaspiCatalogWarehouse нашим названием. */
export interface WarehouseDto {
  id: string;
  code: string;
  kaspiStoreId: string;
  kaspiCityId: string | null;
  name: string | null;
  isActive: boolean;
  /** Снимок последней синхронизации: товаров, остаток и когда посчитано. */
  kaspiOffersCount: number | null;
  kaspiTotalStock: number | null;
  kaspiStatsAt: string | null;
}

/** Тело POST /api/kaspi-catalog/preview: содержимое файлов как текст. */
export interface KaspiCatalogPreviewRequest {
  /** ACTIVE.xml — товары в продаже. */
  active?: string;
  /** ARCHIVE.xml — снятые с продажи. */
  archive?: string;
}
