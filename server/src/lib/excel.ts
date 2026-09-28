import ExcelJS from 'exceljs';

import { AppError } from './errors';

/**
 * Чтение книги Excel и её ячеек.
 *
 * Здесь только то, что не зависит от предметной области: открыть файл, взять
 * список листов, достать из ячейки текст или число. Правила конкретного
 * импорта — какие колонки искать, что считать датой, что деньгами — живут
 * в его собственном парсере.
 *
 * Вынесено из парсера офлайн-продаж, когда за той же работой пришёл второй
 * импорт: одну и ту же ячейку нельзя читать двумя разными способами, иначе
 * файл, который в одном разделе разбирается, в другом молча окажется пустым.
 */

export async function readWorkbook(file: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();

  try {
    // exceljs объявляет свой Buffer из пакета `buffer`, и он не сходится
    // с Buffer из @types/node. Расхождение чисто типовое: значение то же самое.
    await workbook.xlsx.load(file as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    throw new AppError(400, 'BAD_FILE', 'Файл не читается как книга Excel (.xlsx)');
  }

  return workbook;
}

export function listSheets(workbook: ExcelJS.Workbook): string[] {
  return workbook.worksheets.map((sheet) => sheet.name);
}

/** Лист по имени. Нет такого — это ошибка запроса, а не пустой результат. */
export function requireSheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const sheet = workbook.worksheets.find((item) => item.name === name);

  if (!sheet) throw new AppError(404, 'SHEET_NOT_FOUND', `В книге нет листа «${name}»`);

  return sheet;
}

/**
 * Текст ячейки.
 *
 * Пустая строка и пробелы — это «пусто», а не значение: в выгрузках
 * незаполненная ячейка часто содержит пробел, и без этого правила в базу
 * поехали бы поля, которых человек не заполнял.
 */
export function readText(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim() === '' ? null : value.trim();
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toISOString();

  if (isFormula(value)) {
    return value.result === undefined || value.result === null
      ? null
      : readText(value.result as ExcelJS.CellValue);
  }

  // Текст с оформлением приезжает кусками — склеиваем.
  if (isRichText(value)) {
    const text = value.richText.map((part) => part.text).join('').trim();

    return text === '' ? null : text;
  }

  return null;
}

export function readNumber(value: ExcelJS.CellValue): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  // Формулы приезжают объектом с посчитанным результатом в `result`.
  if (isFormula(value)) return typeof value.result === 'number' ? value.result : null;

  return null;
}

export function isFormula(value: unknown): value is { result?: unknown } {
  return typeof value === 'object' && value !== null && 'formula' in value;
}

export function isRichText(value: unknown): value is { richText: { text: string }[] } {
  return typeof value === 'object' && value !== null && 'richText' in value
    && Array.isArray((value as { richText: unknown }).richText);
}
