import ExcelJS from 'exceljs';
import {
  DICTIONARY_KINDS,
  type DictionaryKind,
  type ImportRowProblem,
  type OfflineOrderDraft,
} from '@radeya/shared';

import { AppError } from '../../lib/errors';
import { normalizeName } from '../dictionaries/dictionaries.service';

/**
 * Разбор листа продаж офлайн-точки.
 *
 * Колонки ищутся **по заголовку**, а не по букве: в рабочей книге сотня листов,
 * и порядок колонок на них совпадает не везде. Заголовок, которого нет, —
 * не ошибка: поле останется пустым, а колонка попадёт в список пропущенных.
 *
 * Спорное не угадываем. Строка, где непонятна скидка или не нашёлся способ
 * оплаты, не отклоняется и не «чинится» молча: разобранное едет в заказ,
 * а непонятное — в `problems`, и человек видит его в предпросмотре.
 */

/** Заголовки колонок так, как они записаны в книге. Сравниваются нормализованно. */
const COLUMNS = {
  placedAt: 'Дата',
  shipmentOrigin: 'Откуда поехал товар к клиенту',
  customerSource: 'Откуда Клиенты пришли',
  plannedDeliveryAt: 'Дата доставки по договору',
  externalNumber: 'Номер заказа',
  deliveryStatus: 'Статус доставки',
  deliveryTown: 'Город Доставки и Сумма доставки',
  comment: 'Важные комментарии',
  productType: 'Тип Товара',
  productName: 'Наименование/Размер',
  productNote: 'Описание Товара',
  discount: 'Скидка в процентах',
  totalPrice: 'Продажи',
  paymentMethod: 'Способ оплаты',
  paidAmount: 'Клиент Оплатил',
  balanceDue: 'Остаток от клиента\n(Не отгружать без оплаты)',
  sellerHint: 'Чей рабочий день',
  address: 'Адрес доставки',
} as const;

/**
 * Колонки, которые импорт сознательно не использует.
 *
 * «Промокод визита» в рабочем листе почти всегда содержит дату, а не промокод:
 * заголовок не соответствует содержимому, и класть это в заказ значило бы
 * записать непонятно что.
 */
const IGNORED_COLUMNS = ['Промокод визита'];

/** Заголовок ищем в первых строках: над таблицей бывает шапка отчёта. */
const HEADER_SEARCH_DEPTH = 5;

/**
 * Границы правдоподобной даты в серийных номерах Excel: 2020-01-01 и 2100-01-01.
 *
 * Отсекают служебную строку формул, где в колонке даты лежит сумма за месяц:
 * без проверки она превратилась бы в заказ, оформленный в сорокатысячном году.
 */
const MIN_SERIAL = 43_831;
const MAX_SERIAL = 73_051;

/** Excel считает дни от 30 декабря 1899 года. */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Часовой пояс магазина.
 *
 * В ячейке лежит календарная дата без времени, и это дата **в Астане**,
 * а не в UTC. Без сдвига заказ сохраняется на полночь UTC и показывается
 * как «23.09.2026, 05:00» — время, которого в таблице нет вовсе.
 *
 * Константой, а не часовым поясом сервера: в проде он почти наверняка UTC,
 * и тогда «местная полночь» снова уехала бы на пять часов. Казахстан живёт
 * на UTC+5 круглый год, перевода часов нет.
 */
const BUSINESS_UTC_OFFSET_HOURS = 5;

export interface ParsedSheet {
  rows: OfflineOrderDraft[];
  skipped: number;
  ignoredColumns: string[];
}

/** Индекс справочников: вид → нормализованное название → идентификатор. */
export type DictionaryIndex = Map<DictionaryKind, Map<string, string>>;

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

export function parseSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  dictionaries: DictionaryIndex,
): ParsedSheet {
  const sheet = workbook.worksheets.find((item) => item.name === sheetName);

  if (!sheet) throw new AppError(404, 'SHEET_NOT_FOUND', `В книге нет листа «${sheetName}»`);

  const header = findHeader(sheet);

  if (!header) {
    throw new AppError(
      400,
      'HEADER_NOT_FOUND',
      'На листе не найдена строка заголовков: нет колонок «Дата» и «Продажи»',
    );
  }

  const rows: OfflineOrderDraft[] = [];
  let skipped = 0;

  for (let number = header.row + 1; number <= sheet.rowCount; number += 1) {
    const row = sheet.getRow(number);
    const read = (key: keyof typeof COLUMNS): ExcelJS.CellValue => {
      const column = header.columns.get(key);

      return column === undefined ? null : row.getCell(column).value;
    };

    const placedAt = readDate(read('placedAt'));
    const totalPrice = readMoney(read('totalPrice'));

    // Пустые строки с одним форматированием — просто пропускаем, без записи
    // в замечания: иначе список замечаний заполнят несколько сотен пустышек.
    //
    // Служебная строка итогов отсеивается здесь же: у неё есть сумма за месяц,
    // но нет ни даты, ни одного признака продажи. Заказом она не станет, а без
    // этой проверки каждый импорт начинался бы с одной и той же ошибки.
    if (placedAt === null && !looksLikeSale(read, totalPrice)) {
      skipped += 1;
      continue;
    }

    rows.push(buildDraft(number, read, dictionaries, placedAt, totalPrice));
  }

  const present = new Set(
    sheet.getRow(header.row).values instanceof Array
      ? (sheet.getRow(header.row).values as ExcelJS.CellValue[]).map((value) => normalizeName(String(value ?? '')))
      : [],
  );

  return {
    rows,
    skipped,
    ignoredColumns: IGNORED_COLUMNS.filter((name) => present.has(normalizeName(name))),
  };
}

/**
 * Похоже ли содержимое строки на продажу.
 *
 * Проверяется, когда даты нет: у настоящего заказа тогда всё равно заполнено
 * хоть что-то из товара, оплаты, продавца или адреса — и такую строку надо
 * показать человеку с замечанием, а не проглотить. У строки итогов нет ничего,
 * кроме суммы.
 */
function looksLikeSale(
  read: (key: keyof typeof COLUMNS) => ExcelJS.CellValue,
  totalPrice: string | null,
): boolean {
  if (totalPrice === null) return false;

  const signs: (keyof typeof COLUMNS)[] = [
    'productName', 'paymentMethod', 'sellerHint', 'address', 'shipmentOrigin',
  ];

  return signs.some((key) => readText(read(key)) !== null);
}

function buildDraft(
  rowNumber: number,
  read: (key: keyof typeof COLUMNS) => ExcelJS.CellValue,
  dictionaries: DictionaryIndex,
  placedAt: string | null,
  totalPrice: string | null,
): OfflineOrderDraft {
  const problems: ImportRowProblem[] = [];

  if (placedAt === null) problems.push({ column: COLUMNS.placedAt, message: 'Нет даты оформления' });
  if (totalPrice === null) problems.push({ column: COLUMNS.totalPrice, message: 'Нет суммы продажи' });

  const discount = readDiscount(read('discount'), problems);

  const customerSource = lookup(dictionaries, DICTIONARY_KINDS.CUSTOMER_SOURCE,
    read('customerSource'), COLUMNS.customerSource, problems);
  const deliveryStatus = lookup(dictionaries, DICTIONARY_KINDS.DELIVERY_STATUS,
    read('deliveryStatus'), COLUMNS.deliveryStatus, problems);
  const shipmentOrigin = lookup(dictionaries, DICTIONARY_KINDS.SHIPMENT_ORIGIN,
    read('shipmentOrigin'), COLUMNS.shipmentOrigin, problems);
  const paymentMethod = lookup(dictionaries, DICTIONARY_KINDS.PAYMENT_METHOD,
    read('paymentMethod'), COLUMNS.paymentMethod, problems);

  // Тип товара и описание — это про позицию, а не про заказ. Названия артикулов
  // в файле человеческие («Прага трансформер»), связать их с каталогом
  // автоматически нельзя, поэтому товар остаётся текстом.
  const productNote = [readText(read('productType')), readText(read('productNote'))]
    .filter((part): part is string => part !== null)
    .join(' · ');

  return {
    row: rowNumber,
    placedAt,
    plannedDeliveryAt: readDate(read('plannedDeliveryAt')),
    externalNumber: readText(read('externalNumber')),
    totalPrice,
    paidAmount: readMoney(read('paidAmount')),
    balanceDue: readBalance(read('balanceDue'), problems),
    discountPercent: discount.percent,
    discountComment: discount.comment,
    customerSourceId: customerSource.id,
    deliveryStatusId: deliveryStatus.id,
    shipmentOriginId: shipmentOrigin.id,
    paymentMethodId: paymentMethod.id,
    customerSourceText: customerSource.text,
    deliveryStatusText: deliveryStatus.text,
    shipmentOriginText: shipmentOrigin.text,
    paymentMethodText: paymentMethod.text,
    // Имени и телефона в листе нет вовсе — их заполнят руками в карточке.
    customerName: null,
    customerPhone: null,
    deliveryTown: readText(read('deliveryTown')),
    // Адрес кладём целиком, как есть: в одной ячейке улица, квартира, этаж
    // и два-три телефона. Разбирать это регулярками значит угадывать.
    deliveryFormattedAddress: readText(read('address')),
    productName: readText(read('productName')),
    productNote: productNote === '' ? null : productNote,
    comment: readText(read('comment')),
    sellerHint: readText(read('sellerHint')),
    problems,
  };
}

/** Строка заголовков — та, где есть и «Дата», и «Продажи». */
function findHeader(
  sheet: ExcelJS.Worksheet,
): { row: number; columns: Map<keyof typeof COLUMNS, number> } | null {
  const wanted = new Map<string, keyof typeof COLUMNS>();

  for (const [key, title] of Object.entries(COLUMNS)) {
    wanted.set(normalizeName(title), key as keyof typeof COLUMNS);
  }

  const depth = Math.min(HEADER_SEARCH_DEPTH, sheet.rowCount);

  for (let number = 1; number <= depth; number += 1) {
    const row = sheet.getRow(number);
    const columns = new Map<keyof typeof COLUMNS, number>();

    row.eachCell((cell, index) => {
      const key = wanted.get(normalizeName(String(cell.value ?? '')));

      if (key !== undefined && !columns.has(key)) columns.set(key, index);
    });

    if (columns.has('placedAt') && columns.has('totalPrice')) return { row: number, columns };
  }

  return null;
}

interface Lookup {
  id: string | null;
  text: string | null;
}

/**
 * Значение справочника по тексту из файла.
 *
 * Не нашлось — не ошибка записи, а замечание: списки пополняемые, и новый
 * способ оплаты не повод терять продажу. Текст сохраняется рядом, чтобы
 * в предпросмотре было видно, что именно не совпало.
 */
function lookup(
  dictionaries: DictionaryIndex,
  kind: DictionaryKind,
  value: ExcelJS.CellValue,
  column: string,
  problems: ImportRowProblem[],
): Lookup {
  const text = readText(value);

  if (text === null) return { id: null, text: null };

  const id = dictionaries.get(kind)?.get(normalizeName(text)) ?? null;

  if (id === null) {
    problems.push({ column, message: `Значения «${text}» нет в справочнике` });
  }

  return { id, text };
}

/**
 * Скидка: число процентов отдельно, причина отдельно.
 *
 * В рабочем листе в одной колонке лежат `0.05` (процентный формат Excel),
 * `10` (просто десять процентов), «ликвидация», «800тг» и суммы вроде `420000`.
 * Правило: до единицы включительно — процентный формат, умножаем на сто;
 * до ста — проценты как есть; больше ста — это не процент, а сумма, и она
 * уходит в причину. Текст всегда уходит в причину целиком.
 */
function readDiscount(
  value: ExcelJS.CellValue,
  problems: ImportRowProblem[],
): { percent: number | null; comment: string | null } {
  if (value === null || value === undefined || value === '') {
    return { percent: null, comment: null };
  }

  const amount = readNumber(value);

  if (amount === null) {
    const text = readText(value);

    // Текст вроде «ликвидация+7%» процентом не считаем, даже когда число
    // в нём видно: «+7%» может означать и скидку, и наценку сверху скидки.
    // Показываем замечание — человек поправит в карточке.
    if (text !== null) {
      problems.push({
        column: COLUMNS.discount,
        message: `Скидка «${text}» — процент не распознан, текст записан в причину`,
      });
    }

    return { percent: null, comment: text };
  }

  if (amount === 0) return { percent: null, comment: null };

  if (amount <= 1) return { percent: round2(amount * 100), comment: null };
  if (amount <= 100) return { percent: round2(amount), comment: null };

  problems.push({
    column: COLUMNS.discount,
    message: `«${amount}» не похоже на процент — записано в причину скидки`,
  });

  return { percent: null, comment: String(amount) };
}

/**
 * Остаток от клиента.
 *
 * В листе вместо суммы обычно написано «оплачено» — это ноль. Любой другой
 * текст не выдумываем: он уходит в замечание, а поле остаётся пустым.
 */
function readBalance(value: ExcelJS.CellValue, problems: ImportRowProblem[]): string | null {
  const amount = readMoney(value);

  if (amount !== null) return amount;

  const text = readText(value);

  if (text === null) return null;
  if (normalizeName(text) === 'оплачено') return '0.00';

  problems.push({
    column: COLUMNS.balanceDue,
    message: `«${text}» не сумма — остаток оставлен пустым`,
  });

  return null;
}

/**
 * Дата: exceljs отдаёт либо готовый Date, либо серийный номер Excel.
 *
 * Оба вида означают календарную дату без времени, и оба приводятся к полуночи
 * **в часовом поясе магазина**: день в таблице — это местный день, и заказ
 * за 23 сентября обязан попасть в отчёт за 23 сентября.
 */
function readDate(value: ExcelJS.CellValue): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;

    // exceljs разбирает дату как полночь UTC — берём из неё сам день.
    return toBusinessMidnight(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  const serial = readNumber(value);

  if (serial === null || serial < MIN_SERIAL || serial > MAX_SERIAL) return null;

  // Дробная часть серийного номера — время внутри суток, её отбрасываем:
  // в колонке дат её не бывает, а если появится, это опечатка.
  return toBusinessMidnight(EXCEL_EPOCH_MS + Math.floor(serial) * DAY_MS);
}

function toBusinessMidnight(utcMidnightMs: number): string {
  return new Date(utcMidnightMs - BUSINESS_UTC_OFFSET_HOURS * HOUR_MS).toISOString();
}

/** Деньги строкой с двумя знаками: number на цене теряет тиын. */
function readMoney(value: ExcelJS.CellValue): string | null {
  const amount = readNumber(value);

  return amount === null ? null : amount.toFixed(2);
}

function readNumber(value: ExcelJS.CellValue): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  // Формулы приезжают объектом с посчитанным результатом в `result`.
  if (isFormula(value)) return typeof value.result === 'number' ? value.result : null;

  return null;
}

function readText(value: ExcelJS.CellValue): string | null {
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

function isFormula(value: unknown): value is { result?: unknown } {
  return typeof value === 'object' && value !== null && 'formula' in value;
}

function isRichText(value: unknown): value is { richText: { text: string }[] } {
  return typeof value === 'object' && value !== null && 'richText' in value
    && Array.isArray((value as { richText: unknown }).richText);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
