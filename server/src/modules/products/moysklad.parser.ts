import ExcelJS from 'exceljs';
import {
  MOYSKLAD_CURRENCIES,
  MOYSKLAD_GOODS_TYPES,
  MOYSKLAD_IGNORED_WAREHOUSE_COLUMNS,
  MOYSKLAD_MAX_PREORDER_DAYS,
  MOYSKLAD_WAREHOUSE_COLUMNS,
  type Currency,
  type ImportRowProblem,
  type MoyskladProductDraft,
} from '@radeya/shared';

import { AppError } from '../../lib/errors';
import { readText, requireSheet } from '../../lib/excel';
import { normalizeName } from '../dictionaries/dictionaries.service';

/**
 * Разбор выгрузки товаров МойСклада.
 *
 * Берём из неё то, чего нет в Kaspi: закупочную цену с валютой, поставщика
 * и сроки предзаказа по складам. Новых товаров импорт не заводит — только
 * дополняет уже сохранённые.
 *
 * Колонки ищутся **по заголовку**, а не по букве: в выгрузке их девяносто одна,
 * и порядок меняется от настроек отчёта.
 */

/** Заголовки колонок так, как их пишет МойСклад. Сравниваются нормализованно. */
const COLUMNS = {
  type: 'Тип',
  /**
   * Идентификатор товара.
   *
   * Именно «Код», а не «Артикул»: колонка «Артикул» в проверенной выгрузке
   * заполнена у 40 строк из 1799, а «Код» — у всех 1785 товаров, и формат
   * совпадает с нашими артикулами (`zkz090`, `KN100`, `XRW112`).
   */
  code: 'Код',
  name: 'Наименование',
  purchasePrice: 'Закупочная цена',
  currency: 'Валюта (Закупочная цена)',
  supplier: 'Поставщик',
} as const;

type ColumnKey = keyof typeof COLUMNS;

/** Заголовок ищем в первых строках: над таблицей бывает шапка отчёта. */
const HEADER_SEARCH_DEPTH = 5;

export interface ParsedMoyskladSheet {
  rows: MoyskladProductDraft[];
  total: number;
  filtered: number;
  ignoredColumns: string[];
}

/** Склад из справочника: код и название для показа в предпросмотре. */
export type WarehouseIndex = Map<string, { id: string; name: string }>;

export function parseMoyskladSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  warehouses: WarehouseIndex,
): ParsedMoyskladSheet {
  const sheet = requireSheet(workbook, sheetName);
  const header = findHeader(sheet);

  if (!header) {
    throw new AppError(
      400,
      'HEADER_NOT_FOUND',
      'На листе не найдена строка заголовков: нет колонок «Код» и «Наименование»',
    );
  }

  const goodsTypes = new Set<string>(MOYSKLAD_GOODS_TYPES.map(normalizeName));
  const rows: MoyskladProductDraft[] = [];
  let total = 0;
  let filtered = 0;

  for (let number = header.row + 1; number <= sheet.rowCount; number += 1) {
    const row = sheet.getRow(number);
    const read = (key: ColumnKey): ExcelJS.CellValue => {
      const column = header.columns.get(key);

      return column === undefined ? null : row.getCell(column).value;
    };

    const code = readText(read('code'));
    const name = readText(read('name'));

    // Пустая строка с одним форматированием — не товар вовсе. В счётчики
    // она не идёт: иначе «отброшено» показывало бы хвост листа.
    if (code === null && name === null) continue;

    total += 1;

    if (!goodsTypes.has(normalizeName(readText(read('type')) ?? ''))) {
      filtered += 1;
      continue;
    }

    rows.push(buildDraft(number, code, name, read, row, header.warehouses, warehouses));
  }

  return {
    rows,
    total,
    filtered,
    ignoredColumns: MOYSKLAD_IGNORED_WAREHOUSE_COLUMNS.filter(
      (title) => header.present.has(normalizeName(title)),
    ),
  };
}

function buildDraft(
  rowNumber: number,
  code: string | null,
  name: string | null,
  read: (key: ColumnKey) => ExcelJS.CellValue,
  row: ExcelJS.Row,
  warehouseColumns: Map<number, string>,
  warehouses: WarehouseIndex,
): MoyskladProductDraft {
  const problems: ImportRowProblem[] = [];

  if (code === null) problems.push({ column: COLUMNS.code, message: 'Нет кода товара' });

  const purchasePrice = readMoney(read('purchasePrice'), problems);
  const currency = readCurrency(read('currency'), purchasePrice, problems);

  return {
    row: rowNumber,
    code,
    name,
    // Заполняет сервис: дубли видны только по листу целиком, а базы
    // в парсере нет — лезть в неё отсюда значило бы смешать разбор со сверкой.
    duplicate: false,
    variantId: null,
    variantSku: null,
    purchasePrice,
    currency,
    supplierName: readText(read('supplier')),
    supplierId: null,
    stocks: readStocks(row, warehouseColumns, warehouses, problems),
    problems,
  };
}

/**
 * Сроки предзаказа по складам.
 *
 * Пустая ячейка означает, что **этот склад товар не возит**, и строку остатка
 * для него не создаём. Ноль означал бы «есть в наличии прямо сейчас» — это
 * другое утверждение, и подставлять его вместо пустоты нельзя.
 */
function readStocks(
  row: ExcelJS.Row,
  warehouseColumns: Map<number, string>,
  warehouses: WarehouseIndex,
  problems: ImportRowProblem[],
): MoyskladProductDraft['stocks'] {
  const stocks: MoyskladProductDraft['stocks'] = [];

  for (const [column, code] of warehouseColumns) {
    const text = readText(row.getCell(column).value);

    if (text === null) continue;

    const warehouse = warehouses.get(code);

    if (warehouse === undefined) {
      // Склад, которого нет в справочнике, не выдумываем: сначала «Сохранить
      // склады» на странице синхронизации, потом этот импорт.
      problems.push({ column: code, message: `Склада ${code} нет в справочнике` });
      continue;
    }

    const days = Number.parseInt(text, 10);

    if (!Number.isSafeInteger(days) || days < 0) {
      problems.push({ column: warehouse.name, message: `«${text}» не срок предзаказа` });
      continue;
    }

    if (days > MOYSKLAD_MAX_PREORDER_DAYS) {
      problems.push({
        column: warehouse.name,
        message: `${days} дней — больше предела в ${MOYSKLAD_MAX_PREORDER_DAYS}, срок не записан`,
      });
      continue;
    }

    stocks.push({ warehouseCode: code, warehouseName: warehouse.name, preOrderDays: days });
  }

  return stocks;
}

/**
 * Закупочная цена.
 *
 * В выгрузке она лежит **строкой с запятой** (`"4645,38"`), а не числом.
 * Ноль означает «цена не указана»: товара, который достаётся даром, не бывает,
 * а записанный ноль в отчёте по марже выглядел бы как настоящая закупка.
 */
function readMoney(value: ExcelJS.CellValue, problems: ImportRowProblem[]): string | null {
  const text = readText(value);

  if (text === null) return null;

  const amount = Number.parseFloat(text.replace(/\s/g, '').replace(',', '.'));

  if (!Number.isFinite(amount)) {
    problems.push({ column: COLUMNS.purchasePrice, message: `«${text}» не сумма` });

    return null;
  }

  if (amount <= 0) return null;

  return amount.toFixed(2);
}

/** Валюта: незнакомое название — замечание, а не молчаливое превращение в тенге. */
function readCurrency(
  value: ExcelJS.CellValue,
  purchasePrice: string | null,
  problems: ImportRowProblem[],
): Currency | null {
  const text = readText(value);

  // Валюта без цены ничего не значит и в замечания не идёт: в выгрузке она
  // проставлена у всех строк, включая те, где закупка нулевая.
  if (purchasePrice === null) return null;

  if (text === null) {
    problems.push({ column: COLUMNS.currency, message: 'Цена есть, валюта не указана' });

    return null;
  }

  const currency = MOYSKLAD_CURRENCIES[normalizeName(text)];

  if (currency === undefined) {
    problems.push({ column: COLUMNS.currency, message: `Валюта «${text}» неизвестна` });

    return null;
  }

  return currency;
}

interface Header {
  row: number;
  columns: Map<ColumnKey, number>;
  /** Номер колонки → код нашего склада. */
  warehouses: Map<number, string>;
  /** Все заголовки листа нормализованно — по ним считаем неиспользуемые колонки. */
  present: Set<string>;
}

/** Строка заголовков — та, где есть и «Код», и «Наименование». */
function findHeader(sheet: ExcelJS.Worksheet): Header | null {
  const wanted = new Map<string, ColumnKey>();

  for (const [key, title] of Object.entries(COLUMNS)) {
    wanted.set(normalizeName(title), key as ColumnKey);
  }

  const warehouseTitles = new Map<string, string>();

  for (const [title, warehouse] of Object.entries(MOYSKLAD_WAREHOUSE_COLUMNS)) {
    warehouseTitles.set(normalizeName(title), warehouse.code);
  }

  const depth = Math.min(HEADER_SEARCH_DEPTH, sheet.rowCount);

  for (let number = 1; number <= depth; number += 1) {
    const row = sheet.getRow(number);
    const columns = new Map<ColumnKey, number>();
    const warehouses = new Map<number, string>();
    const present = new Set<string>();

    row.eachCell((cell, index) => {
      const title = normalizeName(String(cell.value ?? ''));

      present.add(title);

      const key = wanted.get(title);

      if (key !== undefined && !columns.has(key)) columns.set(key, index);

      const code = warehouseTitles.get(title);

      if (code !== undefined) warehouses.set(index, code);
    });

    if (columns.has('code') && columns.has('name')) {
      return { row: number, columns, warehouses, present };
    }
  }

  return null;
}
