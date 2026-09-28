import ExcelJS from 'exceljs';
import {
  SUPPLIER_ADDRESS_MAX_LENGTH,
  SUPPLIER_GROUP_SEPARATORS,
  SUPPLIER_IMPORT_GROUP,
  SUPPLIER_NAME_MAX_LENGTH,
  SUPPLIER_PHONE_MAX_LENGTH,
  type ImportRowProblem,
  type SupplierDraft,
} from '@radeya/shared';

import { AppError } from '../../lib/errors';
import { readText, requireSheet } from '../../lib/excel';
import { normalizeName } from '../dictionaries/dictionaries.service';

/**
 * Разбор выгрузки контрагентов МойСклада.
 *
 * Файл содержит **весь** справочник: пять с лишним тысяч покупателей Kaspi,
 * банки, площадки, услуги — и среди них поставщиков. Берём только строки
 * группы «поставщики»: определять поставщика по типу контрагента нельзя,
 * там и покупатели помечены «Юридическое лицо», а по названию — тем более.
 *
 * Отброшенные строки не пропадают бесследно: их количество уходит
 * в предпросмотр, чтобы было видно, что файл разобран целиком.
 */

/** Заголовки колонок так, как их пишет МойСклад. Сравниваются нормализованно. */
const COLUMNS = {
  externalId: 'UUID',
  groups: 'Группы',
  name: 'Наименование',
  address: 'Фактический адрес',
  phone: 'Телефон',
} as const;

type ColumnKey = keyof typeof COLUMNS;

/** Заголовок ищем в первых строках: над таблицей бывает шапка отчёта. */
const HEADER_SEARCH_DEPTH = 5;

/**
 * Минимальная длина телефона в цифрах.
 *
 * Казахстанский номер — одиннадцать цифр с кодом страны, десять без него.
 * Короче — почти наверняка обрывок, и он уходит в замечание, а не молча в базу.
 */
const MIN_PHONE_DIGITS = 10;

/**
 * Телефон-заглушка МойСклада: `+7+0(000)-000-00-00`.
 *
 * Стоит больше чем у трёх с половиной тысяч контрагентов и означает ровно
 * «номера нет». Записать его значит показать в карточке правдоподобную
 * пустышку, которую через месяц кто-нибудь попробует набрать. В замечания
 * тоже не пишем: это не спорное значение, а известное значение по умолчанию.
 */
const PLACEHOLDER_PHONE = /^[78]?0+$/;

export interface ParsedContractors {
  rows: SupplierDraft[];
  /** Строк на листе всего, не считая заголовка. */
  total: number;
  /** Отброшено: контрагент не из группы поставщиков. */
  filtered: number;
}

export function parseContractors(
  workbook: ExcelJS.Workbook,
  sheetName: string,
): ParsedContractors {
  const sheet = requireSheet(workbook, sheetName);
  const header = findHeader(sheet);

  if (!header) {
    throw new AppError(
      400,
      'HEADER_NOT_FOUND',
      'На листе не найдена строка заголовков: нет колонок «Наименование» и «Группы»',
    );
  }

  const rows: SupplierDraft[] = [];
  let total = 0;
  let filtered = 0;

  for (let number = header.row + 1; number <= sheet.rowCount; number += 1) {
    const row = sheet.getRow(number);
    const read = (key: ColumnKey): ExcelJS.CellValue => {
      const column = header.columns.get(key);

      return column === undefined ? null : row.getCell(column).value;
    };

    const name = readText(read('name'));
    const externalId = readText(read('externalId'));

    // Пустая строка с одним форматированием — не контрагент вовсе.
    // В счётчики она не идёт: иначе «отброшено» показывало бы хвост листа.
    if (name === null && externalId === null) continue;

    total += 1;

    if (!isSupplierGroup(readText(read('groups')))) {
      filtered += 1;
      continue;
    }

    rows.push(buildDraft(number, externalId, name, read));
  }

  return { rows, total, filtered };
}

function buildDraft(
  rowNumber: number,
  externalId: string | null,
  name: string | null,
  read: (key: ColumnKey) => ExcelJS.CellValue,
): SupplierDraft {
  const problems: ImportRowProblem[] = [];

  if (name === null) {
    problems.push({ column: COLUMNS.name, message: 'Нет наименования' });
  }

  if (externalId === null) {
    // Без UUID повторный импорт не отличит эту строку от новой и заведёт
    // второго такого же поставщика. Отдельного ключа у нас нет, поэтому
    // строка не записывается, а не «записывается с риском».
    problems.push({ column: COLUMNS.externalId, message: 'Нет UUID — строку не с чем сверять при повторном импорте' });
  }

  return {
    row: rowNumber,
    externalId,
    name: clamp(name, SUPPLIER_NAME_MAX_LENGTH, COLUMNS.name, problems),
    address: clamp(readText(read('address')), SUPPLIER_ADDRESS_MAX_LENGTH, COLUMNS.address, problems),
    phone: readPhone(read('phone'), problems),
    // Заполняет сервис: в парсере базы нет, и лезть в неё отсюда значило бы
    // смешать разбор файла со сверкой.
    known: false,
    diffs: [],
    problems,
  };
}

/**
 * Относится ли контрагент к поставщикам.
 *
 * Группа может быть вложенной (`поставщики/Казахстан`) или перечислением,
 * поэтому сравнивается каждый кусок пути отдельно.
 */
function isSupplierGroup(value: string | null): boolean {
  if (value === null) return false;

  return value
    .split(SUPPLIER_GROUP_SEPARATORS)
    .some((part) => normalizeName(part) === normalizeName(SUPPLIER_IMPORT_GROUP));
}

/**
 * Телефон.
 *
 * Формат не приводим: в выгрузке и `+77052028681`, и `87763422041`, и два
 * номера в одной ячейке. Единый вид красивее, но по дороге к нему теряется
 * добавочный и второй номер, а звонить придётся человеку.
 */
function readPhone(value: ExcelJS.CellValue, problems: ImportRowProblem[]): string | null {
  const text = readText(value);

  if (text === null) return null;

  const digits = text.replace(/\D/g, '');

  if (digits === '' || PLACEHOLDER_PHONE.test(digits)) return null;

  if (digits.length < MIN_PHONE_DIGITS) {
    problems.push({
      column: COLUMNS.phone,
      message: `«${text}» коротковато для номера — записано как есть, проверьте руками`,
    });
  }

  return clamp(text, SUPPLIER_PHONE_MAX_LENGTH, COLUMNS.phone, problems);
}

/**
 * Обрезка по длине поля.
 *
 * Обрезаем, а не отклоняем строку: длинный адрес — это всё-таки адрес.
 * Но молча этого не делаем — человек увидит замечание и поправит.
 */
function clamp(
  value: string | null,
  limit: number,
  column: string,
  problems: ImportRowProblem[],
): string | null {
  if (value === null || value.length <= limit) return value;

  problems.push({ column, message: `Длиннее ${limit} символов — обрезано` });

  return value.slice(0, limit);
}

/** Строка заголовков — та, где есть и «Наименование», и «Группы». */
function findHeader(
  sheet: ExcelJS.Worksheet,
): { row: number; columns: Map<ColumnKey, number> } | null {
  const wanted = new Map<string, ColumnKey>();

  for (const [key, title] of Object.entries(COLUMNS)) {
    wanted.set(normalizeName(title), key as ColumnKey);
  }

  const depth = Math.min(HEADER_SEARCH_DEPTH, sheet.rowCount);

  for (let number = 1; number <= depth; number += 1) {
    const row = sheet.getRow(number);
    const columns = new Map<ColumnKey, number>();

    row.eachCell((cell, index) => {
      const key = wanted.get(normalizeName(String(cell.value ?? '')));

      if (key !== undefined && !columns.has(key)) columns.set(key, index);
    });

    if (columns.has('name') && columns.has('groups')) return { row: number, columns };
  }

  return null;
}
