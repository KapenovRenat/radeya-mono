import type { Currency } from '../constants/currencies';
import type { ImportRowProblem } from './imports';

/**
 * Импорт товаров из выгрузки МойСклада.
 *
 * Заполняет то, чего нет в Kaspi: закупочную цену с валютой, поставщика
 * и сроки предзаказа по складам. Товары не заводит — только дополняет уже
 * сохранённые, найденные по артикулу.
 */

/** Срок предзаказа по одному складу. */
export interface MoyskladStockDraft {
  /** Код нашего склада: `PP3`. */
  warehouseCode: string;
  /** Название склада для показа в предпросмотре. */
  warehouseName: string;
  preOrderDays: number;
}

/** Разобранная строка выгрузки. */
export interface MoyskladProductDraft {
  /** Номер строки в листе. По нему человек находит её глазами. */
  row: number;

  /** Колонка «Код» — по ней ищем артикул в каталоге. */
  code: string | null;
  /** Наименование из файла. Только для показа: название у нас своё. */
  name: string | null;

  /**
   * Код встречается в файле больше одного раза.
   *
   * Такие строки не записываются: из двух строк с одним кодом вторая затёрла бы
   * первую, а какая из них верная — из файла не следует.
   */
  duplicate: boolean;

  /** Найденный у нас артикул. null — товара в каталоге нет, строка не поедет. */
  variantId: string | null;
  /** Артикул так, как он записан у нас: регистр в файле и в базе расходится. */
  variantSku: string | null;

  /** Закупка строкой с двумя знаками. null — в файле ноль или пусто. */
  purchasePrice: string | null;
  currency: Currency | null;

  /** Поставщик из файла и найденный у нас. */
  supplierName: string | null;
  supplierId: string | null;

  /** Склады, по которым в файле указан срок предзаказа. */
  stocks: MoyskladStockDraft[];

  problems: ImportRowProblem[];
}

/** Ответ предпросмотра. В базу на этом шаге ничего не записано. */
export interface MoyskladImportPreview {
  sheets: string[];
  sheet: string | null;

  rows: MoyskladProductDraft[];

  /** Строк на листе всего, не считая заголовка. */
  total: number;
  /** Отброшено: услуги, комплекты, карточки контента. */
  filtered: number;
  /** Строк, у которых код встречается в файле дважды. Такие не записываются. */
  duplicated: number;
  /** Товара с таким кодом нет в каталоге. */
  notFound: number;
  /** Готовы к записи. */
  ready: number;

  /** Поставщики из файла, которых нет в справочнике, со счётчиком товаров. */
  unknownSuppliers: { name: string; count: number }[];
  /** Колонки складов, которые импорт не использует. */
  ignoredColumns: string[];
}

export interface CommitMoyskladImportRequest {
  sheet: string;
  rows: MoyskladProductDraft[];
}

/**
 * Строка отчёта «Остатки».
 *
 * Пустая ячейка количества — это 0 (решение пользователя), отрицательное
 * хранится как есть: продали то, что не посадили.
 */
export interface StockReportRow {
  /** Номер строки в листе. */
  row: number;
  /** Колонка «Код» — по ней ищем артикул, как и в выгрузке товаров. */
  code: string | null;
  /** Наименование из файла, только для показа. */
  name: string | null;

  /** Код встречается в файле дважды — строка не записывается. */
  duplicate: boolean;
  /** В строке есть значение, которое не удалось разобрать, — строка не записывается. */
  invalid: boolean;

  variantId: string | null;
  variantSku: string | null;

  quantity: number;
  reserved: number;
  expected: number;

  /**
   * Себестоимость единицы в тенге, строкой с двумя знаками.
   * null — в файле ноль или пусто: так МойСклад пишет, когда на складе ничего нет,
   * и затирать нулём прежнюю себестоимость нельзя.
   */
  costPrice: string | null;

  /** «Дней на складе» из отчёта. null — пусто. */
  daysOnStock: number | null;

  problems: ImportRowProblem[];
}

/** Товар, который у нас на складе есть, а в отчёте его нет: его остаток обнулится. */
export interface StockZeroCandidate {
  variantId: string;
  sku: string;
  name: string;
  quantity: number | null;
  reserved: number | null;
  expected: number | null;
}

/** Ответ предпросмотра. В базу на этом шаге ничего не записано. */
export interface StockImportPreview {
  sheets: string[];
  sheet: string | null;

  /** Склад, в который пойдёт запись. Показывается крупно: файл другого склада импорт не распознает. */
  warehouse: { id: string; code: string; name: string | null };

  /**
   * Момент отчёта из шапки «на момент:», ISO.
   * null — в шапке не нашёлся: при записи возьмётся время записи.
   */
  stockAt: string | null;

  rows: StockReportRow[];

  /** Товарных строк в отчёте. */
  total: number;
  /** Строк-папок («Диваны/Мадрид 310») — пропущены. */
  groups: number;
  duplicated: number;
  invalid: number;
  /** Товара с таким кодом нет в каталоге. */
  notFound: number;
  /** Готовы к записи. */
  ready: number;

  /** Обнулятся при записи: есть у нас на этом складе, в отчёте нет. */
  toZero: StockZeroCandidate[];
}

export interface CommitStockImportRequest {
  sheet: string;
  warehouseId: string;
  stockAt: string | null;
  rows: StockReportRow[];
  /**
   * Что обнулить — ровно список из предпросмотра, который видел человек.
   * Сервер не вычисляет его заново: разрушающее действие должно совпадать
   * с тем, что показали. Но проверяет, что товара нет в отчёте.
   */
  zeroVariantIds: string[];
}

export interface CommitStockImportResponse {
  /** Товаров, у которых записан остаток. */
  updated: number;
  /** Товаров, чей остаток обнулён. */
  zeroed: number;
  /** Записано себестоимостей. */
  costsSet: number;
  failed: { row: number; message: string }[];
}

export interface CommitMoyskladImportResponse {
  /** Артикулов, у которых что-то изменилось. */
  updated: number;
  /** Записано закупочных цен, поставщиков, строк складов. */
  pricesSet: number;
  suppliersSet: number;
  stocksSet: number;
  /** Строк, которые не удалось записать, и почему. */
  failed: { row: number; message: string }[];
}
