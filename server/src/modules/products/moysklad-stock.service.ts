import {
  AUDIT_ACTIONS,
  HISTORY_ENTITY_TYPES,
  type CommitStockImportResponse,
  type StockImportPreview,
  type StockReportRow,
  type StockZeroCandidate,
} from '@radeya/shared';

import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../db/client';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { listSheets, readWorkbook } from '../../lib/excel';
import { diffFields, recordHistory, type HistoryEntry, type HistoryMeta } from '../../lib/history';
import { normalizeName } from '../dictionaries/dictionaries.service';
import { loadSkuIndex, markDuplicateCodes } from './moysklad.common';
import { parseStockReport } from './moysklad-stock.parser';
import type { CommitStockInput, PreviewStockInput } from './moysklad.schemas';

/**
 * Импорт остатков из отчёта «Остатки» МойСклада — по одному складу за раз.
 *
 * Отчёт — это полный снимок склада на момент времени. Поэтому, в отличие
 * от выгрузки товаров, здесь **молчание файла что-то значит**: товар, который
 * у нас на этом складе есть, а в отчёте его нет, продан — и его остаток
 * обнуляется. Иначе старая цифра осталась бы навсегда и ушла на Kaspi.
 * Обнуляется ровно список, показанный в предпросмотре.
 *
 * Товаров импорт не заводит, срок предзаказа не трогает — это другое поле
 * того же склада, его пишет импорт товаров.
 */

/** Пишем пачками в отдельных транзакциях — см. WRITE_BATCH в moysklad.service. */
const WRITE_BATCH = 100;

const TRANSACTION_TIMEOUT_MS = 60_000;
const TRANSACTION_MAX_WAIT_MS = 15_000;

const DAY_MS = 24 * 60 * 60 * 1000;

const ZEROED_NOTE = 'Нет в отчёте остатков — обнулено';

export async function previewStockImport(
  file: Buffer,
  input: PreviewStockInput,
): Promise<StockImportPreview> {
  const warehouse = await requireWarehouse(input.warehouseId);
  const workbook = await readWorkbook(file);
  const sheets = listSheets(workbook);

  if (input.sheet === undefined) {
    return {
      sheets, sheet: null, warehouse, stockAt: null, rows: [],
      total: 0, groups: 0, duplicated: 0, invalid: 0, notFound: 0, ready: 0, toZero: [],
    };
  }

  const parsed = parseStockReport(workbook, input.sheet);
  const rows = await matchCatalog(markDuplicateCodes(parsed.rows));

  return {
    sheets,
    sheet: input.sheet,
    warehouse,
    stockAt: parsed.stockAt,
    rows,
    total: rows.length,
    groups: parsed.groups,
    duplicated: rows.filter((row) => row.duplicate).length,
    invalid: rows.filter((row) => row.invalid).length,
    notFound: rows.filter((row) => row.variantId === null && !row.duplicate && row.code !== null).length,
    ready: rows.filter(canWrite).length,
    toZero: await findZeroCandidates(warehouse.id, mentionedCodes(rows)),
  };
}

async function requireWarehouse(id: string) {
  const warehouse = await prisma.warehouse.findUnique({
    where: { id },
    select: { id: true, code: true, name: true },
  });

  if (!warehouse) throw new NotFoundError('Склад не найден');

  return warehouse;
}

async function matchCatalog(rows: StockReportRow[]): Promise<StockReportRow[]> {
  const bySku = await loadSkuIndex();

  return rows.map((row) => {
    // У задвоенного кода артикул не ищем: пустой `variantId` не пускает строку в запись.
    const variant = row.code === null || row.duplicate ? undefined : bySku.get(normalizeName(row.code));

    if (row.code === null || row.duplicate) return row;

    if (variant === undefined) {
      return {
        ...row,
        problems: [...row.problems,
          { column: 'Код', message: `Товара с кодом «${row.code}» нет в каталоге` }],
      };
    }

    return { ...row, variantId: variant.id, variantSku: variant.sku };
  });
}

/**
 * Все коды, упомянутые в отчёте, — включая задвоенные и не найденные.
 *
 * По ним решается, что обнулять. Задвоенный код в отчёте есть, просто
 * непонятно, какая из строк верная, — обнулять такой товар нельзя.
 */
function mentionedCodes(rows: StockReportRow[]): Set<string> {
  return new Set(rows.flatMap((row) => (row.code === null ? [] : [normalizeName(row.code)])));
}

/**
 * Что обнулится: строки склада, где хоть одна цифра не ноль, а товара в отчёте нет.
 *
 * Пустой остаток (`null`) не трогаем: это «не указан» — склад заведён импортом
 * сроков предзаказа, и отчёт об остатках про него ничего не утверждает.
 * `not: 0` в SQL пустые и так не берёт: `NULL <> 0` не истина.
 */
async function findZeroCandidates(warehouseId: string, mentioned: Set<string>): Promise<StockZeroCandidate[]> {
  const stocks = await prisma.variantStock.findMany({
    where: {
      warehouseId,
      OR: [{ quantity: { not: 0 } }, { reserved: { not: 0 } }, { expected: { not: 0 } }],
    },
    select: {
      quantity: true, reserved: true, expected: true,
      variant: { select: { id: true, sku: true, product: { select: { name: true } } } },
    },
    orderBy: { variant: { sku: 'asc' } },
  });

  return stocks
    .filter((stock) => !mentioned.has(normalizeName(stock.variant.sku)))
    .map((stock) => ({
      variantId: stock.variant.id,
      sku: stock.variant.sku,
      name: stock.variant.product.name,
      quantity: stock.quantity,
      reserved: stock.reserved,
      expected: stock.expected,
    }));
}

function canWrite(row: StockReportRow): boolean {
  return row.variantId !== null && !row.duplicate && !row.invalid;
}

/**
 * Средняя дата поступления того, что лежит: момент отчёта минус средние дни.
 * Нет остатка или дней — даты нет: «дней на складе» у пустого склада не бывает.
 */
function receivedAtOf(row: StockReportRow, stockAt: Date): Date | null {
  if (row.quantity <= 0 || row.daysOnStock === null) return null;

  return new Date(stockAt.getTime() - row.daysOnStock * DAY_MS);
}

/**
 * Запись.
 *
 * Остаток, резерв и ожидание перезаписываются целиком — это снимок, а не
 * дополнение. Себестоимость пишется только непустая. История — в транзакции
 * каждой пачки, по записи на товар, склад — в контексте.
 */
export async function commitStockImport(
  input: CommitStockInput,
  meta: HistoryMeta,
): Promise<CommitStockImportResponse> {
  const warehouse = await requireWarehouse(input.warehouseId);
  const stockAt = input.stockAt === null ? new Date() : new Date(input.stockAt);

  const failed: { row: number; message: string }[] = [];
  const writable: StockReportRow[] = [];
  const seen = new Set<string>();

  for (const row of input.rows) {
    if (!canWrite(row)) continue;

    // Два разных кода в файле на один артикул — вторая строка затёрла бы первую.
    if (seen.has(row.variantId!)) {
      failed.push({ row: row.row, message: 'Этот товар уже встречался выше в файле' });
      continue;
    }

    seen.add(row.variantId!);
    writable.push(row);
  }

  const zeroIds = await checkZeroList(input.zeroVariantIds, mentionedCodes(input.rows));

  if (writable.length === 0 && zeroIds.length === 0) {
    throw new ValidationError('Ни одна строка не готова к записи');
  }

  const context = { warehouse: warehouse.code, sheet: input.sheet };
  let updated = 0;
  let costsSet = 0;
  let zeroed = 0;

  for (let from = 0; from < writable.length; from += WRITE_BATCH) {
    const batch = writable.slice(from, from + WRITE_BATCH);

    await prisma.$transaction(async (tx) => {
      const current = await loadCurrent(tx, warehouse.id, batch.map((row) => row.variantId!));
      const history: HistoryEntry[] = [];

      for (const row of batch) {
        const variantId = row.variantId!;
        const before = current.get(variantId);
        const stock = {
          quantity: row.quantity,
          reserved: row.reserved,
          expected: row.expected,
          receivedAt: receivedAtOf(row, stockAt),
          stockAt,
        };

        await tx.variantStock.upsert({
          where: { variantId_warehouseId: { variantId, warehouseId: warehouse.id } },
          create: { variantId, warehouseId: warehouse.id, ...stock },
          update: stock,
        });

        if (row.costPrice !== null) {
          await tx.variant.update({ where: { id: variantId }, data: { costPrice: row.costPrice } });
          costsSet += 1;
        }

        history.push({
          type: AUDIT_ACTIONS.MOYSKLAD_STOCK_IMPORTED,
          entityType: HISTORY_ENTITY_TYPES.VARIANT,
          entityId: variantId,
          changes: diffFields(HISTORY_ENTITY_TYPES.VARIANT, {
            quantity: before?.stock?.quantity ?? null,
            reserved: before?.stock?.reserved ?? null,
            expected: before?.stock?.expected ?? null,
            costPrice: before?.costPrice ?? null,
          }, {
            quantity: row.quantity,
            reserved: row.reserved,
            expected: row.expected,
            costPrice: row.costPrice ?? undefined,
          }),
          context,
        });

        updated += 1;
      }

      await recordHistory(tx, meta, history);
    }, { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS });
  }

  for (let from = 0; from < zeroIds.length; from += WRITE_BATCH) {
    const batch = zeroIds.slice(from, from + WRITE_BATCH);

    zeroed += await prisma.$transaction(async (tx) => {
      const current = await loadCurrent(tx, warehouse.id, batch);
      const history: HistoryEntry[] = [];
      let count = 0;

      for (const variantId of batch) {
        const before = current.get(variantId)?.stock;

        // Между предпросмотром и записью строку могли обнулить или удалить.
        if (!before || [before.quantity, before.reserved, before.expected]
          .every((value) => value === null || value === 0)) continue;

        const zero = { quantity: 0, reserved: 0, expected: 0 };

        await tx.variantStock.update({
          where: { variantId_warehouseId: { variantId, warehouseId: warehouse.id } },
          data: { ...zero, receivedAt: null, stockAt },
        });

        history.push({
          type: AUDIT_ACTIONS.MOYSKLAD_STOCK_IMPORTED,
          entityType: HISTORY_ENTITY_TYPES.VARIANT,
          entityId: variantId,
          changes: diffFields(HISTORY_ENTITY_TYPES.VARIANT, before, zero),
          context: { ...context, note: ZEROED_NOTE },
        });

        count += 1;
      }

      await recordHistory(tx, meta, history);

      return count;
    }, { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS });
  }

  return { updated, zeroed, costsSet, failed };
}

/**
 * Проверка списка на обнуление.
 *
 * Список приходит от клиента — ровно то, что человек видел в предпросмотре.
 * Доверять ему нельзя, поэтому сервер отбрасывает товары, упомянутые в отчёте:
 * обнулить товар, у которого в файле есть остаток, — худшая ошибка импорта.
 */
async function checkZeroList(ids: string[], mentioned: Set<string>): Promise<string[]> {
  if (ids.length === 0) return [];

  const variants = await prisma.variant.findMany({
    where: { id: { in: ids } },
    select: { id: true, sku: true },
  });

  return variants
    .filter((variant) => !mentioned.has(normalizeName(variant.sku)))
    .map((variant) => variant.id);
}

/** Прежние значения пачки — «было» для истории. Одним запросом на пачку. */
async function loadCurrent(tx: Prisma.TransactionClient, warehouseId: string, variantIds: string[]) {
  const variants = await tx.variant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      costPrice: true,
      stocks: {
        where: { warehouseId },
        select: { quantity: true, reserved: true, expected: true },
      },
    },
  });

  return new Map(variants.map((variant) => [variant.id, {
    costPrice: variant.costPrice,
    stock: variant.stocks[0] ?? null,
  }]));
}
