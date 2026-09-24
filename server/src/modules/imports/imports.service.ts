import {
  DICTIONARY_KINDS,
  ORDER_STATUSES,
  SALES_POINT_TYPES,
  type AuthUser,
  type CommitOfflineImportResponse,
  type DictionaryKind,
  type ImportUnknownValue,
  type OfflineImportPreview,
  type OfflineOrderDraft,
  type OrderStatus,
} from '@radeya/shared';

import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../db/client';
import { AppError, NotFoundError, ValidationError } from '../../lib/errors';
import { loadDictionaryIndex, normalizeName } from '../dictionaries/dictionaries.service';
import { listSheets, parseSheet, readWorkbook } from './offline-orders.parser';
import type { CommitImportInput, PreviewImportInput } from './imports.schemas';

/**
 * Импорт продаж офлайн-точки из книги Excel.
 *
 * Два шага. Предпросмотр разбирает файл и **ничего не пишет**: человек видит,
 * что получилось, какие строки отклонены и какие значения не нашлись
 * в справочниках. Запись берёт именно те строки, которые он увидел.
 */

/** Длина порядкового номера в коде заказа: `OFF-1-000042`. */
const SEQUENCE_LENGTH = 6;

/** Импорт сотен строк не укладывается в стандартные пять секунд транзакции. */
const TRANSACTION_TIMEOUT_MS = 120_000;
const TRANSACTION_MAX_WAIT_MS = 15_000;

/**
 * Стадия заказа по рабочему статусу доставки.
 *
 * Сопоставлены только однозначные значения. Всё остальное — «в пути»,
 * «хранится на витрине», «отправила карточку» — на вопрос «какая стадия
 * у заказа» не отвечает, и такие строки получают `NEW`: подставить
 * правдоподобную стадию значит записать догадку, которую потом никто
 * не отличит от настоящей.
 */
const STATUS_BY_DELIVERY_STATUS = new Map<string, OrderStatus>([
  ['доставлен клиенту', ORDER_STATUSES.DELIVERED],
  ['доставлен частично', ORDER_STATUSES.DELIVERED],
  ['оформлен возврат', ORDER_STATUSES.RETURNED],
  ['отмена заказа (причину описать)', ORDER_STATUSES.CANCELLED],
  ['ошибочный ввод', ORDER_STATUSES.CANCELLED],
]);

export async function previewOfflineImport(
  file: Buffer,
  input: PreviewImportInput,
): Promise<OfflineImportPreview> {
  const workbook = await readWorkbook(file);
  const sheets = listSheets(workbook);

  if (input.sheet === undefined) {
    // Лист ещё не выбран: отдаём только оглавление книги. Разбирать наугад
    // нечего — в рабочей книге сотня листов за разные месяцы и точки.
    return {
      sheets, sheet: null, rows: [], skipped: 0, invalid: 0,
      unknownValues: [], ignoredColumns: [],
    };
  }

  const dictionaries = await loadDictionaryIndex();
  const parsed = parseSheet(workbook, input.sheet, dictionaries);

  return {
    sheets,
    sheet: input.sheet,
    rows: parsed.rows,
    skipped: parsed.skipped,
    invalid: parsed.rows.filter((row) => !canWrite(row)).length,
    unknownValues: collectUnknown(parsed.rows, dictionaries),
    ignoredColumns: parsed.ignoredColumns,
  };
}

/**
 * Запись разобранных строк.
 *
 * Одна строка — один заказ, даже когда у двух строк один покупатель и адрес:
 * два товара в одну дату — это две продажи, и складывать их в один заказ
 * значит потерять, что именно продано. Номер из файла для группировки не годится
 * и подавно: он заполнен примерно у трети строк.
 *
 * Всё в одной транзакции: половина импортированного месяца хуже, чем ничего —
 * при повторе получились бы дубли, а найти, где оборвалось, не по чему.
 */
export async function commitOfflineImport(
  input: CommitImportInput,
  author: AuthUser,
): Promise<CommitOfflineImportResponse> {
  const point = await prisma.salesPoint.findUnique({
    where: { id: input.salesPointId },
    select: { id: true, code: true, type: true, isActive: true },
  });

  if (!point) throw new NotFoundError('Точка продаж не найдена');

  if (point.type !== SALES_POINT_TYPES.OFFLINE) {
    throw new ValidationError('Импортировать продажи можно только в офлайн-точку');
  }

  if (!point.isActive) throw new ValidationError('Точка продаж закрыта');

  const failed: { row: number; message: string }[] = [];
  const writable: OfflineOrderDraft[] = [];

  for (const row of input.rows) {
    if (canWrite(row)) writable.push(row);
    else failed.push({ row: row.row, message: 'Нет даты оформления или суммы продажи' });
  }

  if (writable.length === 0) {
    throw new ValidationError('Ни одна строка не готова к записи');
  }

  const created = await prisma.$transaction(async (tx) => {
    let sequence = await lastSequence(tx, point.code);

    for (const row of writable) {
      sequence += 1;

      await tx.order.create({
        data: {
          code: buildCode(point.code, sequence),
          salesPointId: point.id,
          // Продавца ставит админ руками: в листе стоит «чей рабочий день»,
          // а это не всегда тот, кто оформил. Имя сохраняем в комментарии.
          sellerId: null,
          status: readStatus(row),
          // Поля площадки у офлайн-заказа пустые: он не из Kaspi.
          kaspiStatus: '',
          deliveryType: null,
          placedAt: new Date(row.placedAt!),
          plannedDeliveryAt: row.plannedDeliveryAt ? new Date(row.plannedDeliveryAt) : null,
          externalNumber: row.externalNumber,
          totalPrice: row.totalPrice!,
          paidAmount: row.paidAmount,
          balanceDue: row.balanceDue,
          discountPercent: row.discountPercent,
          discountComment: row.discountComment,
          customerSourceId: row.customerSourceId,
          deliveryStatusId: row.deliveryStatusId,
          shipmentOriginId: row.shipmentOriginId,
          paymentMethodId: row.paymentMethodId,
          customerName: row.customerName,
          customerPhone: row.customerPhone,
          deliveryTown: row.deliveryTown,
          deliveryFormattedAddress: row.deliveryFormattedAddress,
          ...(row.productName !== null || row.productNote !== null
            ? {
                entries: {
                  create: {
                    // Позиция одна: строка листа описывает одну продажу.
                    entryNumber: 1,
                    offerName: row.productName,
                    note: row.productNote,
                    quantity: 1,
                    totalPrice: row.totalPrice,
                  },
                },
              }
            : {}),
          comments: {
            create: {
              authorId: author.id,
              authorRole: author.role,
              text: buildComment(row, input.sheet),
            },
          },
        },
      });
    }

    return writable.length;
  }, { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS });

  return { created, failed };
}

/** Без даты и суммы заказ не записать: по дате считают выручку, сумма и есть выручка. */
function canWrite(row: OfflineOrderDraft): boolean {
  return row.placedAt !== null && row.totalPrice !== null;
}

function readStatus(row: OfflineOrderDraft): OrderStatus {
  if (row.deliveryStatusText === null) return ORDER_STATUSES.NEW;

  return STATUS_BY_DELIVERY_STATUS.get(normalizeName(row.deliveryStatusText))
    ?? ORDER_STATUSES.NEW;
}

/**
 * Комментарий импортированного заказа.
 *
 * Сюда же уходит «чей рабочий день»: продавца в заказе пока нет, а терять имя
 * нельзя — по нему админ потом и проставит. Название листа — чтобы через год
 * было понятно, откуда взялась запись.
 */
function buildComment(row: OfflineOrderDraft, sheet: string): string {
  const parts = [`Импортировано из листа «${sheet}», строка ${row.row}.`];

  if (row.sellerHint !== null) parts.push(`Рабочий день: ${row.sellerHint}.`);
  if (row.comment !== null) parts.push(row.comment);

  return parts.join(' ');
}

/**
 * Последний использованный порядковый номер точки.
 *
 * Номер дополнен нулями до постоянной длины, поэтому сортировка по строке
 * совпадает с числовой: `OFF-1-000010` больше `OFF-1-000009`. Без дополнения
 * «10» оказалось бы меньше «9», и счётчик пошёл бы по второму кругу.
 */
async function lastSequence(tx: Prisma.TransactionClient, pointCode: string): Promise<number> {
  const prefix = pointCode + '-';
  const last = await tx.order.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });

  if (!last) return 0;

  const number = Number.parseInt(last.code.slice(prefix.length), 10);

  if (!Number.isSafeInteger(number)) {
    throw new AppError(
      500,
      'BAD_ORDER_CODE',
      `Номер заказа «${last.code}» не разобрать — счётчик точки продолжить нечем`,
    );
  }

  return number;
}

/** Номер офлайн-заказа: `OFF-1-000042`. Буквы в начале не дают совпасть с номером Kaspi. */
function buildCode(pointCode: string, sequence: number): string {
  return pointCode + '-' + String(sequence).padStart(SEQUENCE_LENGTH, '0');
}

/**
 * Значения, которых нет в справочниках.
 *
 * Считаем по всему листу, а не по строкам: «в файле 14 раз встречается
 * неизвестный способ оплаты» — это одно решение человека, а не четырнадцать.
 */
function collectUnknown(
  rows: OfflineOrderDraft[],
  dictionaries: Map<DictionaryKind, Map<string, string>>,
): ImportUnknownValue[] {
  const counts = new Map<string, ImportUnknownValue>();

  const check = (kind: DictionaryKind, text: string | null, id: string | null): void => {
    if (text === null || id !== null) return;
    if (dictionaries.get(kind)?.has(normalizeName(text))) return;

    const key = kind + '\u0000' + normalizeName(text);
    const seen = counts.get(key);

    if (seen) seen.count += 1;
    else counts.set(key, { kind, value: text, count: 1 });
  };

  for (const row of rows) {
    check(DICTIONARY_KINDS.CUSTOMER_SOURCE, row.customerSourceText, row.customerSourceId);
    check(DICTIONARY_KINDS.DELIVERY_STATUS, row.deliveryStatusText, row.deliveryStatusId);
    check(DICTIONARY_KINDS.SHIPMENT_ORIGIN, row.shipmentOriginText, row.shipmentOriginId);
    check(DICTIONARY_KINDS.PAYMENT_METHOD, row.paymentMethodText, row.paymentMethodId);
  }

  return [...counts.values()].sort((a, b) => b.count - a.count);
}
