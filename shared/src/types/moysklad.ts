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
