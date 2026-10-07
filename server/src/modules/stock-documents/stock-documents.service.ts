import {
  STOCK_DOCUMENT_TYPES,
  STOCK_PICKER_PAGE_SIZE,
  formatStockDocumentNumber,
  type StockDocumentDto,
  type StockDocumentListResponse,
  type StockPickerResponse,
} from '@radeya/shared';

import { prisma } from '../../db/client';
import { Prisma } from '../../generated/prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors';
import type { HistoryMeta } from '../../lib/history';
import { variantSearchWhere } from '../products/variant-search';
import { lineAmount, totalAmount, writeOffPrice } from './stock-document-money';
import {
  stockDocumentListSelect,
  stockVariantSelect,
  toStockDocumentDto,
  toStockDocumentListItem,
  toStockVariantDto,
} from './stock-documents.mapper';
import type { SaveStockDocumentInput, StockDocumentListInput, StockPickerInput } from './stock-documents.schemas';
import { POSTING_TRANSACTION_OPTIONS, applyPosting } from './stock-posting.service';

/** Автор записи; проверка права проводить — в контроллере. */
type DocumentMeta = HistoryMeta & { author: { id: string } };

/**
 * Документы склада: список, просмотр и черновики. Запись черновика остатков
 * не трогает. С галочкой «Проведено» (`input.post`) в той же транзакции идёт
 * проведение — stock-posting.service.ts: не провелось — не записался и черновик,
 * полусозданного документа не остаётся.
 */

/** Список: свежие сверху. Страница и счётчик — из одного снимка. */
export async function listStockDocuments(input: StockDocumentListInput): Promise<StockDocumentListResponse> {
  const where: Prisma.StockDocumentWhereInput = {
    ...(input.type ? { type: input.type } : {}),
    ...(input.warehouseId ? { warehouseId: input.warehouseId } : {}),
    ...(input.number !== undefined ? { number: input.number } : {}),
  };

  const [total, records] = await prisma.$transaction([
    prisma.stockDocument.count({ where }),
    prisma.stockDocument.findMany({
      where,
      select: stockDocumentListSelect,
      orderBy: [{ createdAt: 'desc' }, { number: 'desc' }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

  return {
    items: records.map(toStockDocumentListItem),
    total,
    page: input.page,
    pageSize: input.pageSize,
    totalPages: Math.ceil(total / input.pageSize),
  };
}

/** Документ со строками. Остаток в строке — на складе документа сейчас. */
export async function getStockDocument(
  number: number,
  client: Prisma.TransactionClient = prisma,
): Promise<StockDocumentDto> {
  const record = await client.stockDocument.findUnique({
    where: { number },
    select: { ...stockDocumentListSelect, warehouseId: true },
  });

  if (!record) throw new NotFoundError(`Документ ${formatStockDocumentNumber(number)} не найден`);

  const lines = await client.stockDocumentLine.findMany({
    where: { documentId: record.id },
    select: { id: true, quantity: true, price: true, amount: true,
      variant: { select: stockVariantSelect(record.warehouseId) } },
    orderBy: { position: 'asc' },
  });

  return toStockDocumentDto(record, lines);
}

/** Новый документ. Номер выдаёт база. */
export async function createStockDocument(
  input: SaveStockDocumentInput,
  meta: DocumentMeta,
): Promise<StockDocumentDto> {
  return prisma.$transaction(async (tx) => {
    await requireActiveWarehouse(tx, input.warehouseId);

    const lines = await priceLines(tx, input);
    const created = await tx.stockDocument.create({
      data: {
        type: input.type,
        warehouseId: input.warehouseId,
        comment: input.comment,
        totalAmount: totalAmount(lines.map((line) => line.amount)),
        createdById: meta.author.id,
        lines: { create: lines },
      },
      select: { id: true, number: true },
    });

    if (input.post) await applyPosting(tx, created.id, created.number, meta);

    return getStockDocument(created.number, tx);
  }, POSTING_TRANSACTION_OPTIONS);
}

/** Правка черновика: шапка и строки целиком. Проведённый не правится. */
export async function updateStockDocument(
  number: number,
  input: SaveStockDocumentInput,
  meta: DocumentMeta,
): Promise<StockDocumentDto> {
  return prisma.$transaction(async (tx) => {
    const { id } = await lockDraft(tx, number);

    await requireActiveWarehouse(tx, input.warehouseId);

    const lines = await priceLines(tx, input);

    await tx.stockDocumentLine.deleteMany({ where: { documentId: id } });
    await tx.stockDocument.update({
      where: { id },
      data: {
        type: input.type,
        warehouseId: input.warehouseId,
        comment: input.comment,
        totalAmount: totalAmount(lines.map((line) => line.amount)),
        lines: { create: lines },
      },
    });

    if (input.post) await applyPosting(tx, id, number, meta);

    return getStockDocument(number, tx);
  }, POSTING_TRANSACTION_OPTIONS);
}

/** Удаление черновика. Проведённый удалить нельзя: остатки уже изменены. */
export async function deleteStockDocument(number: number): Promise<StockDocumentDto> {
  return prisma.$transaction(async (tx) => {
    const { id } = await lockDraft(tx, number);
    const document = await getStockDocument(number, tx);

    await tx.stockDocument.delete({ where: { id } });

    return document;
  });
}

/**
 * Товары для окна выбора: поиск как в каталоге, остаток — на складе документа.
 * Снятые с продажи тоже показываются: их можно оприходовать и списать.
 */
export async function listStockPickerVariants(input: StockPickerInput): Promise<StockPickerResponse> {
  const where = variantSearchWhere(input.search);

  const [total, variants] = await prisma.$transaction([
    prisma.variant.count({ where }),
    prisma.variant.findMany({
      where,
      select: stockVariantSelect(input.warehouseId),
      orderBy: [{ product: { name: 'asc' } }, { sku: 'asc' }],
      skip: (input.page - 1) * STOCK_PICKER_PAGE_SIZE,
      take: STOCK_PICKER_PAGE_SIZE,
    }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

  return {
    items: variants.map(toStockVariantDto),
    total,
    page: input.page,
    pageSize: STOCK_PICKER_PAGE_SIZE,
    totalPages: Math.ceil(total / STOCK_PICKER_PAGE_SIZE),
  };
}

/**
 * Черновик под блокировкой строки: два человека не поправят и не удалят
 * один документ одновременно, и проведение не встанет посреди правки.
 */
export async function lockDraft(tx: Prisma.TransactionClient, number: number): Promise<{ id: string }> {
  const [locked] = await tx.$queryRaw<{ id: string; postedAt: Date | null }[]>`
    SELECT "id", "postedAt" FROM "StockDocument" WHERE "number" = ${number} FOR UPDATE`;

  if (!locked) throw new NotFoundError(`Документ ${formatStockDocumentNumber(number)} не найден`);

  if (locked.postedAt !== null) {
    throw new ConflictError(`Документ ${formatStockDocumentNumber(number)} уже проведён — его нельзя изменить или удалить`);
  }

  return { id: locked.id };
}

/** Новый документ — только на действующий склад: закрытый склад не принимает и не отдаёт товар. */
async function requireActiveWarehouse(tx: Prisma.TransactionClient, warehouseId: string): Promise<void> {
  const warehouse = await tx.warehouse.findUnique({ where: { id: warehouseId }, select: { isActive: true } });

  if (!warehouse) throw new NotFoundError('Склад не найден');
  if (!warehouse.isActive) throw new ValidationError('Склад закрыт — выберите другой');
}

/**
 * Строки с ценой и суммой. Оприходование — закупочная цена из запроса, списание —
 * себестоимость товара (при проведении она берётся ещё раз, свежая).
 */
async function priceLines(tx: Prisma.TransactionClient, input: SaveStockDocumentInput) {
  const ids = input.lines.map((line) => line.variantId);
  const variants = await tx.variant.findMany({
    where: { id: { in: ids } },
    select: { id: true, costPrice: true },
  });
  const costById = new Map(variants.map((variant) => [variant.id, variant.costPrice]));

  if (costById.size !== ids.length) {
    throw new NotFoundError('Часть товаров не найдена в каталоге — обновите страницу');
  }

  return input.lines.map((line, position) => {
    // Схема требует цену у оприходования; у списания присланная игнорируется.
    const price = input.type === STOCK_DOCUMENT_TYPES.ENTER && line.price !== undefined
      ? new Prisma.Decimal(line.price)
      : writeOffPrice(costById.get(line.variantId) ?? null);

    return {
      variantId: line.variantId,
      quantity: line.quantity,
      price,
      amount: lineAmount(price, line.quantity),
      position,
    };
  });
}
