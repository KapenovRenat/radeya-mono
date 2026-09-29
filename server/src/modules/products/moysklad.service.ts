import {
  AUDIT_ACTIONS,
  HISTORY_ENTITY_TYPES,
  MOYSKLAD_WAREHOUSE_COLUMNS,
  type CommitMoyskladImportResponse,
  type MoyskladImportPreview,
  type MoyskladProductDraft,
} from '@radeya/shared';

import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../db/client';
import { ValidationError } from '../../lib/errors';
import { listSheets, readWorkbook } from '../../lib/excel';
import { diffFields, recordHistory, type HistoryEntry, type HistoryMeta } from '../../lib/history';
import { normalizeName } from '../dictionaries/dictionaries.service';
import { loadSkuIndex, markDuplicateCodes } from './moysklad.common';
import { parseMoyskladSheet, type WarehouseIndex } from './moysklad.parser';
import type { CommitMoyskladInput, PreviewMoyskladInput } from './moysklad.schemas';

/**
 * Импорт закупки, поставщиков и сроков предзаказа из выгрузки МойСклада.
 *
 * Товаров не заводит: каталог наполняется из кабинета Kaspi, а здесь
 * дополняются уже сохранённые артикулы. Артикул, которого у нас нет,
 * получает замечание — заводить товар по строке из чужой системы значило бы
 * создать карточку без цены, картинок и связи с площадкой.
 *
 * Повторная заливка безопасна по устройству: импорт обновляет существующие
 * записи, а не создаёт новые, поэтому дублей здесь быть не может.
 */

/**
 * Размер пачки записи.
 *
 * Пишем пачками в отдельных транзакциях, а не всё одной: полторы тысячи
 * артикулов с четырьмя складами каждый — это тысячи операторов, и одна
 * транзакция на всё держала бы блокировки минутами. Оборваться на середине
 * здесь не страшно: повтор просто дозапишет остальное — в отличие от импорта
 * продаж, где половина месяца превратилась бы в дубли.
 */
const WRITE_BATCH = 100;

const TRANSACTION_TIMEOUT_MS = 60_000;
const TRANSACTION_MAX_WAIT_MS = 15_000;

export async function previewMoyskladImport(
  file: Buffer,
  input: PreviewMoyskladInput,
): Promise<MoyskladImportPreview> {
  const workbook = await readWorkbook(file);
  const sheets = listSheets(workbook);

  if (input.sheet === undefined) {
    return {
      sheets, sheet: null, rows: [], total: 0, filtered: 0,
      duplicated: 0, notFound: 0, ready: 0,
      unknownSuppliers: [], ignoredColumns: [],
    };
  }

  const parsed = parseMoyskladSheet(workbook, input.sheet, await loadWarehouses());
  const rows = await matchCatalog(markDuplicateCodes(parsed.rows));

  return {
    sheets,
    sheet: input.sheet,
    rows,
    total: parsed.total,
    filtered: parsed.filtered,
    duplicated: rows.filter((row) => row.duplicate).length,
    notFound: rows.filter((row) => row.variantId === null && !row.duplicate).length,
    ready: rows.filter(canWrite).length,
    unknownSuppliers: collectUnknownSuppliers(rows),
    ignoredColumns: parsed.ignoredColumns,
  };
}

/**
 * Склады справочника по коду.
 *
 * Если название в справочнике пустое — берём его из раскладки МойСклада:
 * `Warehouse.name` заполняет человек, выгрузка Kaspi названий не содержит,
 * и без этого в интерфейсе везде виден голый код `PP3`.
 */
async function loadWarehouses(): Promise<WarehouseIndex> {
  const rows = await prisma.warehouse.findMany({ select: { id: true, code: true, name: true } });

  return new Map(rows.map((row) => [
    row.code,
    { id: row.id, name: row.name ?? moyskladWarehouseName(row.code) ?? row.code },
  ]));
}

/** Название склада так, как оно записано в заголовке колонки выгрузки. */
function moyskladWarehouseName(code: string): string | null {
  for (const warehouse of Object.values(MOYSKLAD_WAREHOUSE_COLUMNS)) {
    if (warehouse.code === code) return warehouse.name;
  }

  return null;
}

/**
 * Сверка с каталогом и справочником поставщиков.
 *
 * Названия поставщиков сравниваются в памяти по той же причине, что и артикулы
 * (см. loadSkuIndex): регистр. Поставщиков десятки.
 */
async function matchCatalog(rows: MoyskladProductDraft[]): Promise<MoyskladProductDraft[]> {
  const [bySku, suppliers] = await Promise.all([
    loadSkuIndex(),
    prisma.supplier.findMany({ select: { id: true, name: true } }),
  ]);

  const bySupplier = new Map(suppliers.map((supplier) => [normalizeName(supplier.name), supplier.id]));

  return rows.map((row) => {
    const problems = [...row.problems];

    // У задвоенного кода артикул не ищем вовсе: пустой `variantId` и есть то,
    // что не пускает такую строку в запись.
    const variant = row.code === null || row.duplicate
      ? undefined
      : bySku.get(normalizeName(row.code));

    if (row.code !== null && !row.duplicate && variant === undefined) {
      problems.push({ column: 'Код', message: `Товара с кодом «${row.code}» нет в каталоге` });
    }

    const supplierId = row.supplierName === null
      ? null
      : bySupplier.get(normalizeName(row.supplierName)) ?? null;

    if (row.supplierName !== null && supplierId === null) {
      problems.push({
        column: 'Поставщик',
        message: `Поставщика «${row.supplierName}» нет в справочнике — поле останется пустым`,
      });
    }

    return {
      ...row,
      variantId: variant?.id ?? null,
      variantSku: variant?.sku ?? null,
      supplierId,
      problems,
    };
  });
}

/**
 * Поставщики из файла, которых нет в справочнике.
 *
 * Считаем по файлу целиком, а не по строкам: «поставщика нет, на нём 189
 * товаров» — это одно решение человека, а не сто восемьдесят девять.
 */
function collectUnknownSuppliers(rows: MoyskladProductDraft[]): { name: string; count: number }[] {
  const counts = new Map<string, { name: string; count: number }>();

  for (const row of rows) {
    if (row.supplierName === null || row.supplierId !== null) continue;

    const key = normalizeName(row.supplierName);
    const seen = counts.get(key);

    if (seen) seen.count += 1;
    else counts.set(key, { name: row.supplierName, count: 1 });
  }

  return [...counts.values()].sort((a, b) => b.count - a.count);
}

/**
 * Названия складам, у которых их ещё нет.
 *
 * `Warehouse.name` заполняет человек — выгрузка Kaspi названий не содержит,
 * и в справочнике они пустые, отчего везде в интерфейсе виден голый код `PP3`.
 * В файле МойСклада названия написаны словами в заголовках колонок, и раз уж
 * мы всё равно их читаем, заодно и проставим.
 *
 * Только пустые: название, введённое руками, важнее нашей раскладки.
 */
async function fillWarehouseNames(): Promise<void> {
  for (const warehouse of Object.values(MOYSKLAD_WAREHOUSE_COLUMNS)) {
    await prisma.warehouse.updateMany({
      where: { code: warehouse.code, name: null },
      data: { name: warehouse.name },
    });
  }
}

/**
 * Записывается строка, у которой нашёлся артикул и есть что записать.
 *
 * Строка без единого заполненного поля не «записывается впустую»: она попала бы
 * в счётчик обновлённых, не изменив ничего, и цифра врала бы.
 */
function canWrite(row: MoyskladProductDraft): boolean {
  if (row.variantId === null) return false;

  return row.purchasePrice !== null || row.supplierId !== null || row.stocks.length > 0;
}

/**
 * Запись.
 *
 * Пустое в файле ничего не затирает: нет цены — оставляем свою, нет поставщика —
 * оставляем своего. Иначе каждая выгрузка откатывала бы правки, сделанные
 * руками, и понять, почему закупка «сама» обнулилась, было бы нечем.
 *
 * Строки складов дозаписываются, а не пересобираются: склад, которого в файле
 * нет, у нас мог появиться руками, и удалять его из-за молчания чужой выгрузки
 * нельзя. Трогаем только `preOrderDays` — `quantity` ведётся отдельно.
 *
 * История пишется в транзакции каждой пачки, по записи на товар и отдельно
 * на каждый склад — склад идёт в контекст записи, а не в имя поля.
 */
export async function commitMoyskladImport(
  input: CommitMoyskladInput,
  meta: HistoryMeta,
): Promise<CommitMoyskladImportResponse> {
  const failed: { row: number; message: string }[] = [];
  const writable: MoyskladProductDraft[] = [];

  for (const row of input.rows) {
    if (canWrite(row)) writable.push(row);
    else if (row.variantId !== null) failed.push({ row: row.row, message: 'Нечего записывать' });
  }

  if (writable.length === 0) {
    throw new ValidationError('Ни одна строка не готова к записи');
  }

  const [warehouses, supplierNames] = await Promise.all([
    loadWarehouses(),
    // В историю пишется название поставщика, а не UUID: «a1b2-… → c3d4-…»
    // человеку ничего не скажет.
    prisma.supplier.findMany({ select: { id: true, name: true } })
      .then((rows) => new Map(rows.map((row) => [row.id, row.name]))),
  ]);

  await fillWarehouseNames();

  let updated = 0;
  let pricesSet = 0;
  let suppliersSet = 0;
  let stocksSet = 0;

  for (let from = 0; from < writable.length; from += WRITE_BATCH) {
    const batch = writable.slice(from, from + WRITE_BATCH);

    await prisma.$transaction(async (tx) => {
      const current = await loadCurrentValues(tx, batch.map((row) => row.variantId!));
      const history: HistoryEntry[] = [];

      for (const row of batch) {
        const before = current.get(row.variantId!);
        const fields = {
          ...(row.purchasePrice !== null
            ? { purchasePrice: row.purchasePrice, purchaseCurrency: row.currency }
            : {}),
          ...(row.supplierId !== null ? { supplierId: row.supplierId } : {}),
        };

        if (Object.keys(fields).length > 0) {
          await tx.variant.update({ where: { id: row.variantId! }, data: fields });
        }

        history.push({
          type: AUDIT_ACTIONS.MOYSKLAD_PRODUCTS_IMPORTED,
          entityType: HISTORY_ENTITY_TYPES.VARIANT,
          entityId: row.variantId!,
          changes: diffFields(HISTORY_ENTITY_TYPES.VARIANT, before ?? null, {
            purchasePrice: fields.purchasePrice,
            purchaseCurrency: fields.purchaseCurrency,
            supplier: fields.supplierId === undefined
              ? undefined
              : supplierNames.get(fields.supplierId) ?? null,
          }),
          context: { sheet: input.sheet },
        });

        if (row.purchasePrice !== null) pricesSet += 1;
        if (row.supplierId !== null) suppliersSet += 1;

        for (const stock of row.stocks) {
          const warehouse = warehouses.get(stock.warehouseCode);

          // Склад мог исчезнуть между предпросмотром и записью — тогда строка
          // остатка просто не пишется, а не роняет весь импорт.
          if (warehouse === undefined) continue;

          history.push({
            type: AUDIT_ACTIONS.MOYSKLAD_PRODUCTS_IMPORTED,
            entityType: HISTORY_ENTITY_TYPES.VARIANT,
            entityId: row.variantId!,
            changes: diffFields(
              HISTORY_ENTITY_TYPES.VARIANT,
              before?.stocks.get(warehouse.id) ?? null,
              { preOrderDays: stock.preOrderDays },
            ),
            context: { warehouse: stock.warehouseCode, sheet: input.sheet },
          });

          await tx.variantStock.upsert({
            where: {
              variantId_warehouseId: { variantId: row.variantId!, warehouseId: warehouse.id },
            },
            // Остаток не трогаем ни при создании, ни при обновлении: файл
            // МойСклада говорит только про срок предзаказа.
            create: {
              variantId: row.variantId!,
              warehouseId: warehouse.id,
              preOrderDays: stock.preOrderDays,
            },
            update: { preOrderDays: stock.preOrderDays },
          });

          stocksSet += 1;
        }

        updated += 1;
      }

      await recordHistory(tx, meta, history);
    }, { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS });
  }

  return { updated, pricesSet, suppliersSet, stocksSet, failed };
}

/** Прежние значения пачки — «было» для истории. Одним запросом на пачку, а не на товар. */
async function loadCurrentValues(tx: Prisma.TransactionClient, variantIds: string[]) {
  const rows = await tx.variant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true, purchasePrice: true, purchaseCurrency: true,
      supplier: { select: { name: true } },
      stocks: { select: { warehouseId: true, preOrderDays: true } },
    },
  });

  return new Map(rows.map((row) => [row.id, {
    purchasePrice: row.purchasePrice,
    purchaseCurrency: row.purchaseCurrency,
    supplier: row.supplier?.name ?? null,
    stocks: new Map(row.stocks.map((stock) => [
      stock.warehouseId, { preOrderDays: stock.preOrderDays },
    ])),
  }]));
}
