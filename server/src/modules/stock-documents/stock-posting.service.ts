import {
  AUDIT_ACTIONS,
  CURRENCIES,
  HISTORY_ENTITY_TYPES,
  STOCK_DOCUMENT_TYPES,
  formatStockDocumentNumber,
} from '@radeya/shared';

import type { Prisma } from '../../generated/prisma/client';
import { ConflictError, ValidationError } from '../../lib/errors';
import { diffFields, recordHistory, type HistoryEntry, type HistoryMeta } from '../../lib/history';
import { lineAmount, totalAmount, writeOffPrice } from './stock-document-money';

/**
 * Проведение трогает сотни строк остатка — дольше стандартных 5 секунд Prisma.
 * Транзакцию с проведением открывает stock-documents.service.ts с этими пределами.
 */
export const POSTING_TRANSACTION_OPTIONS = { timeout: 30_000, maxWait: 10_000 } as const;

/** Сколько нехваток перечислить в ошибке списания: дальше список не читают. */
const SHORTAGES_IN_MESSAGE = 10;

interface LockedStock {
  id: string;
  variantId: string;
  quantity: number | null;
  receivedAt: Date | null;
}

/**
 * Проведение документа: остатки, себестоимость и история — одной транзакцией.
 *
 * - **Оприходование:** остаток + n, средняя дата поступления пересчитывается
 *   с учётом новой партии, цена строки становится **закупкой** товара в тенге
 *   (решение пользователя 07.10.2026). Себестоимость оприходование не трогает:
 *   её будет считать приёмка — закупка + упаковка + доля накладных.
 * - **Списание:** остаток − n; в минус нельзя — тогда не проводится ничего,
 *   а в ошибке перечислены товары, которых не хватает. Цена — себестоимость
 *   на момент проведения, а не на момент черновика.
 *
 * Строки остатка блокируются `FOR UPDATE` в порядке id товара: два документа,
 * проводимые одновременно по одним товарам, встают в очередь, а не затирают
 * друг друга и не ловят взаимную блокировку.
 *
 * Вызывается внутри транзакции записи черновика (галочка «Проведено»): документ
 * уже записан и заблокирован вызывающим, проведённым он ещё не был.
 */
export async function applyPosting(
  tx: Prisma.TransactionClient,
  id: string,
  number: number,
  meta: HistoryMeta & { author: { id: string } },
): Promise<void> {
  const document = await tx.stockDocument.findUniqueOrThrow({
    where: { id },
    select: {
      type: true, warehouseId: true,
      warehouse: { select: { code: true, isActive: true } },
      lines: {
        select: { id: true, variantId: true, quantity: true, price: true,
          variant: { select: { sku: true, costPrice: true, purchasePrice: true, purchaseCurrency: true } } },
        orderBy: { position: 'asc' },
      },
    },
  });

  if (!document.warehouse.isActive) throw new ValidationError('Склад закрыт — документ не проводится');
  if (document.lines.length === 0) throw new ValidationError('В документе нет товаров');

  const isEnter = document.type === STOCK_DOCUMENT_TYPES.ENTER;
  const now = new Date();
  const stocks = await lockStocks(tx, document.warehouseId, document.lines.map((line) => line.variantId), isEnter);

  if (!isEnter) assertEnoughStock(document.lines, stocks);

  const context = { warehouse: document.warehouse.code, document: formatStockDocumentNumber(number) };
  const history: HistoryEntry[] = [];
  const amounts: Prisma.Decimal[] = [];

  for (const line of document.lines) {
    const stock = stocks.get(line.variantId);
    const before = stock?.quantity ?? null;
    const current = before ?? 0;
    const next = isEnter ? current + line.quantity : current - line.quantity;

    if (stock !== undefined) {
      await tx.variantStock.update({
        where: { id: stock.id },
        data: {
          quantity: next,
          receivedAt: isEnter
            ? averageReceivedAt(stock.receivedAt, current, now, line.quantity)
            : next > 0 ? stock.receivedAt : null,
          stockAt: now,
        },
      });
    }

    // Оприходование задаёт закупку (документ в тенге — валюта закупки
    // становится тенге); списание идёт по себестоимости и ничего не меняет.
    const purchaseBefore = { purchasePrice: line.variant.purchasePrice, purchaseCurrency: line.variant.purchaseCurrency };
    const purchaseAfter = isEnter
      ? { purchasePrice: line.price, purchaseCurrency: CURRENCIES.KZT }
      : { purchasePrice: undefined, purchaseCurrency: undefined };

    if (isEnter && (purchaseBefore.purchasePrice === null || !purchaseBefore.purchasePrice.equals(line.price)
      || purchaseBefore.purchaseCurrency !== CURRENCIES.KZT)) {
      await tx.variant.update({
        where: { id: line.variantId },
        data: { purchasePrice: line.price, purchaseCurrency: CURRENCIES.KZT },
      });
    }

    if (!isEnter) {
      const price = writeOffPrice(line.variant.costPrice);
      const amount = lineAmount(price, line.quantity);

      await tx.stockDocumentLine.update({ where: { id: line.id }, data: { price, amount } });
      amounts.push(amount);
    }

    history.push({
      type: AUDIT_ACTIONS.STOCK_DOCUMENT_POSTED,
      entityType: HISTORY_ENTITY_TYPES.VARIANT,
      entityId: line.variantId,
      changes: diffFields(HISTORY_ENTITY_TYPES.VARIANT,
        { quantity: before, ...purchaseBefore },
        { quantity: next, ...purchaseAfter }),
      context,
    });
  }

  await tx.stockDocument.update({
    where: { id },
    data: {
      postedAt: now,
      postedById: meta.author.id,
      // У оприходования сумма уже посчитана в черновике и не меняется.
      ...(isEnter ? {} : { totalAmount: totalAmount(amounts) }),
    },
  });

  await recordHistory(tx, meta, history);
}

/**
 * Строки остатка документа под блокировкой.
 *
 * Оприходованию недостающие строки создаются: товар впервые пришёл на склад.
 * `skipDuplicates` — если строку в это же время завёл другой документ,
 * вторая вставка молча пропустится, а блокировка ниже дождётся первой.
 */
async function lockStocks(
  tx: Prisma.TransactionClient,
  warehouseId: string,
  variantIds: string[],
  createMissing: boolean,
): Promise<Map<string, LockedStock>> {
  const ids = [...new Set(variantIds)].sort();

  if (createMissing) {
    await tx.variantStock.createMany({
      data: ids.map((variantId) => ({ variantId, warehouseId })),
      skipDuplicates: true,
    });
  }

  const rows = await tx.$queryRaw<LockedStock[]>`
    SELECT "id", "variantId", "quantity", "receivedAt" FROM "VariantStock"
    WHERE "warehouseId" = ${warehouseId}::uuid AND "variantId" = ANY(${ids}::uuid[])
    ORDER BY "variantId"
    FOR UPDATE`;

  return new Map(rows.map((row) => [row.variantId, row]));
}

/** Списание в минус запрещено — решение пользователя. Пустой остаток считается нулём. */
function assertEnoughStock(
  lines: { variantId: string; quantity: number; variant: { sku: string } }[],
  stocks: Map<string, LockedStock>,
): void {
  const shortages = lines.flatMap((line) => {
    const available = stocks.get(line.variantId)?.quantity ?? 0;

    return available < line.quantity
      ? [`${line.variant.sku} — есть ${available}, списываете ${line.quantity}`]
      : [];
  });

  if (shortages.length === 0) return;

  const shown = shortages.slice(0, SHORTAGES_IN_MESSAGE).join('; ');
  const more = shortages.length > SHORTAGES_IN_MESSAGE ? ` и ещё ${shortages.length - SHORTAGES_IN_MESSAGE}` : '';

  throw new ConflictError(`Не хватает остатка: ${shown}${more}`);
}

/**
 * Средняя дата поступления после прихода партии — взвешенная по количеству,
 * как «дней на складе» в МойСкладе. Отрицательный остаток весом не считается:
 * лежащего товара нет, и новая партия — единственная.
 */
function averageReceivedAt(previous: Date | null, onHand: number, now: Date, added: number): Date {
  if (previous === null || onHand <= 0) return now;

  return new Date(Math.round((previous.getTime() * onHand + now.getTime() * added) / (onHand + added)));
}
