import ExcelJS from 'exceljs';
import {
  MOYSKLAD_MAX_DAYS_ON_STOCK,
  MOYSKLAD_MAX_STOCK_QUANTITY,
  MOYSKLAD_REPORT_UTC_OFFSET_HOURS,
  type ImportRowProblem,
  type StockReportRow,
} from '@radeya/shared';

import { AppError } from '../../lib/errors';
import { readNumber, readText, requireSheet } from '../../lib/excel';
import { normalizeName } from '../dictionaries/dictionaries.service';

/**
 * Разбор отчёта «Остатки» МойСклада.
 *
 * Как устроен файл (проверено 29.09.2026 на выгрузке склада Астаны):
 * - сверху шапка отчёта: «отчет создан», «исполнитель», «на момент: 29.09.2026 07:44:00»;
 * - строка заголовков — восьмая, поэтому ищем её глубже, чем в выгрузке товаров;
 * - между товарами строки-папки: заполнен только «Код», там путь вида
 *   «Диваны/Мадрид 310 Трансформер»;
 * - в конце строка «Итого:».
 *
 * Колонки ищутся по заголовку, а не по букве: состав колонок задаётся
 * настройками отчёта.
 */

const COLUMNS = {
  code: 'Код',
  name: 'Наименование',
  available: 'Доступно',
  reserved: 'Резерв',
  expected: 'Ожидание',
  quantity: 'Остаток',
  costPrice: 'Себестоимость',
  daysOnStock: 'Дней на складе',
} as const;

type ColumnKey = keyof typeof COLUMNS;

/** Без этих колонок отчёт — не отчёт остатков. */
const REQUIRED: readonly ColumnKey[] = ['code', 'name', 'quantity'];

/** В проверенном файле заголовок в восьмой строке; с запасом на другие настройки шапки. */
const HEADER_SEARCH_DEPTH = 20;

/** Подпись момента отчёта в шапке. */
const STOCK_AT_LABEL = 'на момент:';

/** Строка итогов закрывает таблицу. */
const TOTALS_LABEL = 'итого';

const HOUR_MS = 60 * 60 * 1000;

export interface ParsedStockReport {
  rows: StockReportRow[];
  /** Момент отчёта, ISO. null — в шапке не нашёлся. */
  stockAt: string | null;
  groups: number;
}

export function parseStockReport(workbook: ExcelJS.Workbook, sheetName: string): ParsedStockReport {
  const sheet = requireSheet(workbook, sheetName);
  const header = findHeader(sheet);

  if (!header) {
    throw new AppError(
      400,
      'HEADER_NOT_FOUND',
      'На листе не найдена строка заголовков: нет колонок «Код», «Наименование» и «Остаток». '
        + 'Это точно отчёт «Остатки»?',
    );
  }

  const rows: StockReportRow[] = [];
  let groups = 0;

  for (let number = header.row + 1; number <= sheet.rowCount; number += 1) {
    const row = sheet.getRow(number);
    const read = (key: ColumnKey): ExcelJS.CellValue => {
      const column = header.columns.get(key);

      return column === undefined ? null : row.getCell(column).value;
    };

    const code = readText(read('code'));
    const name = readText(read('name'));

    if (name !== null && normalizeName(name).startsWith(TOTALS_LABEL)) break;
    if (code === null && name === null) continue;

    // Папка: путь в колонке кода, наименования нет. Товаром не является.
    if (name === null) {
      groups += 1;
      continue;
    }

    rows.push(buildRow(number, code, name, read, header.columns));
  }

  return { rows, stockAt: findStockAt(sheet, header.row), groups };
}

function buildRow(
  rowNumber: number,
  code: string | null,
  name: string,
  read: (key: ColumnKey) => ExcelJS.CellValue,
  columns: Map<ColumnKey, number>,
): StockReportRow {
  const problems: ImportRowProblem[] = [];

  if (code === null) problems.push({ column: COLUMNS.code, message: 'Нет кода товара' });

  const quantity = readCount(read('quantity'), COLUMNS.quantity, problems);
  const reserved = columns.has('reserved') ? readCount(read('reserved'), COLUMNS.reserved, problems) : 0;
  const expected = columns.has('expected') ? readCount(read('expected'), COLUMNS.expected, problems) : 0;
  const invalid = quantity === null || reserved === null || expected === null;

  // «Доступно» не храним, но сверяем: не сошлось — значит, колонки перепутаны
  // или формула у МойСклада не та, что мы думаем. Строку это не блокирует.
  const available = columns.has('available') ? readNumber(read('available')) : null;

  if (!invalid && available !== null && available !== quantity - reserved + expected) {
    problems.push({
      column: COLUMNS.available,
      message: `Доступно ${available}, а Остаток − Резерв + Ожидание = ${quantity - reserved + expected}`,
    });
  }

  return {
    row: rowNumber,
    code,
    name,
    // Заполняет сервис: дубли видны только по листу целиком, каталог — в базе.
    duplicate: false,
    invalid,
    variantId: null,
    variantSku: null,
    quantity: quantity ?? 0,
    reserved: reserved ?? 0,
    expected: expected ?? 0,
    costPrice: readCost(read('costPrice')),
    daysOnStock: readDays(read('daysOnStock'), problems),
    problems,
  };
}

/**
 * Количество. Пустая ячейка — 0 (решение пользователя), отрицательное — как есть.
 * Дробное или не число — замечание и null: подставить правдоподобное значение
 * значило бы записать догадку.
 */
function readCount(value: ExcelJS.CellValue, column: string, problems: ImportRowProblem[]): number | null {
  const text = readText(value);

  if (text === null) return 0;

  const amount = readNumber(value) ?? Number.parseFloat(text.replace(/\s/g, '').replace(',', '.'));

  if (!Number.isInteger(amount)) {
    problems.push({ column, message: `«${text}» не целое количество` });

    return null;
  }

  if (Math.abs(amount) > MOYSKLAD_MAX_STOCK_QUANTITY) {
    problems.push({ column, message: `${amount} — больше предела в ${MOYSKLAD_MAX_STOCK_QUANTITY}` });

    return null;
  }

  return amount;
}

/**
 * Себестоимость единицы. Ноль — «не указана»: МойСклад пишет ноль, когда
 * на складе ничего нет, и затереть им прежнюю себестоимость значило бы
 * потерять её. Длинный хвост дроби (`69719.97333…`) округляется до тиын.
 */
function readCost(value: ExcelJS.CellValue): string | null {
  const text = readText(value);

  if (text === null) return null;

  const amount = readNumber(value) ?? Number.parseFloat(text.replace(/\s/g, '').replace(',', '.'));

  return Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : null;
}

/**
 * Дней на складе. Ноль у пустого склада — это «нечего считать», а не «приехало сегодня».
 * Неправдоподобное число — замечание и null: остаток записывается, срок нет.
 */
function readDays(value: ExcelJS.CellValue, problems: ImportRowProblem[]): number | null {
  const text = readText(value);

  if (text === null) return null;

  const days = readNumber(value) ?? Number.parseFloat(text.replace(/\s/g, '').replace(',', '.'));

  if (!Number.isFinite(days) || days <= 0) return null;

  if (days > MOYSKLAD_MAX_DAYS_ON_STOCK) {
    problems.push({ column: COLUMNS.daysOnStock, message: `${days} дней — неправдоподобно, срок не записан` });

    return null;
  }

  return days;
}

/**
 * Момент отчёта из шапки: ячейка «на момент:» и значение правее неё.
 *
 * В файле это текст `29.09.2026 07:44:00`, но Excel при пересохранении мог
 * превратить его в дату — тогда exceljs отдаёт Date, где часы лежат в UTC-полях
 * как есть. Оба случая читаются как время Астаны.
 */
function findStockAt(sheet: ExcelJS.Worksheet, headerRow: number): string | null {
  for (let number = 1; number < headerRow; number += 1) {
    const row = sheet.getRow(number);

    for (let index = 1; index < row.cellCount; index += 1) {
      if (normalizeName(readText(row.getCell(index).value) ?? '') !== STOCK_AT_LABEL) continue;

      // Значение — в первой непустой ячейке правее подписи.
      for (let next = index + 1; next <= row.cellCount; next += 1) {
        const value = row.getCell(next).value;

        if (readText(value) !== null || value instanceof Date) return readReportMoment(value);
      }
    }
  }

  return null;
}

const MOMENT_PATTERN = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

function readReportMoment(value: ExcelJS.CellValue): string | null {
  const offset = MOYSKLAD_REPORT_UTC_OFFSET_HOURS * HOUR_MS;

  if (value instanceof Date) return new Date(value.getTime() - offset).toISOString();

  const match = MOMENT_PATTERN.exec(readText(value) ?? '');

  if (!match) return null;

  const [, day, month, year, hours = '0', minutes = '0', seconds = '0'] = match;
  const utc = Date.UTC(Number(year), Number(month) - 1, Number(day),
    Number(hours), Number(minutes), Number(seconds)) - offset;

  return Number.isFinite(utc) ? new Date(utc).toISOString() : null;
}

interface Header {
  row: number;
  columns: Map<ColumnKey, number>;
}

function findHeader(sheet: ExcelJS.Worksheet): Header | null {
  const wanted = new Map<string, ColumnKey>();

  for (const [key, title] of Object.entries(COLUMNS)) {
    wanted.set(normalizeName(title), key as ColumnKey);
  }

  const depth = Math.min(HEADER_SEARCH_DEPTH, sheet.rowCount);

  for (let number = 1; number <= depth; number += 1) {
    const columns = new Map<ColumnKey, number>();

    sheet.getRow(number).eachCell((cell, index) => {
      // Перенос строки в заголовке («Сумма\nсебестоимости») normalizeName сводит к пробелу.
      const key = wanted.get(normalizeName(String(cell.value ?? '')));

      if (key !== undefined && !columns.has(key)) columns.set(key, index);
    });

    if (REQUIRED.every((key) => columns.has(key))) return { row: number, columns };
  }

  return null;
}
