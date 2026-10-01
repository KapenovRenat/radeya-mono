import { DISPATCH_KINDS, ORDER_STATUSES, type DispatchKind, type OrderStatus } from '@radeya/shared';

import { prisma } from '../../../../../db/client';
import type { WorkerSettings } from '../../../../../generated/prisma/client';
import { buildCardData, dispatchEntrySelect, dispatchOrderSelect, entryName } from './dispatch-data';
import { CANCEL_STATUSES, MAX_ORDERS_PER_RUN, SEND_PAUSE_MS } from './dispatch.constants';
import type { DispatchBudget } from './dispatch-new';
import type { OrderCardKind } from './order-card';
import type { Recipient } from './recipients';
import { sendDispatch } from './send-dispatch';

export interface FollowUpStats {
  cancelSent: number;
  returnSent: number;
  failed: number;
}

/**
 * Отмены и возвраты — только тем, кому заказ уже ушёл, и туда же, куда ушёл
 * (получатель снимком из отправки заказа). Не уходил — сообщать не о чем.
 *
 * Отмена одна на позицию: «отмена в пути», а потом «отменён» — это одна отмена.
 * Отмены первыми в цикле: по ним получателю нужно остановить отгрузку.
 */
export async function dispatchFollowUps(
  settings: WorkerSettings,
  budget: DispatchBudget,
  signal: AbortSignal,
): Promise<FollowUpStats> {
  const stats: FollowUpStats = { cancelSent: 0, returnSent: 0, failed: 0 };

  await sendFollowUps(DISPATCH_KINDS.CANCEL, CANCEL_STATUSES, settings, budget, signal, stats);
  await sendFollowUps(DISPATCH_KINDS.RETURN, [ORDER_STATUSES.RETURNED], settings, budget, signal, stats);

  return stats;
}

async function sendFollowUps(
  kind: Exclude<DispatchKind, 'NEW'>,
  orderStatuses: readonly OrderStatus[],
  settings: WorkerSettings,
  budget: DispatchBudget,
  signal: AbortSignal,
  stats: FollowUpStats,
): Promise<void> {
  if (budget.left <= 0) return;

  // Ушедший заказ, который отменили или вернули, а сообщения об этом ещё нет
  // (или оно ждёт повтора). Фильтр в базе, а не в коде: иначе с ростом истории
  // первые N строк навсегда занимали бы уже обработанные.
  const sent = await prisma.orderDispatch.findMany({
    where: {
      kind: DISPATCH_KINDS.NEW,
      status: 'SENT',
      order: { status: { in: [...orderStatuses] } },
      entry: { dispatches: { none: { kind, status: { in: ['SENT', 'SKIPPED', 'FAILED'] } } } },
    },
    select: {
      recipient: true, supplierId: true, warehouseId: true, recipientName: true, chatId: true,
      order: { select: dispatchOrderSelect },
      entry: { select: dispatchEntrySelect },
    },
    orderBy: { sentAt: 'asc' },
    take: MAX_ORDERS_PER_RUN,
  });

  for (const dispatch of sent) {
    if (budget.left <= 0) return;
    signal.throwIfAborted();

    const recipient = snapshotRecipient(dispatch);

    // Снимка нет только у пропущенных, а здесь отправленные — страховка от кривой строки.
    if (recipient === null) continue;

    const { order, entry } = dispatch;
    const cardKind: OrderCardKind = kind === DISPATCH_KINDS.RETURN
      ? 'RETURN'
      : order.status === ORDER_STATUSES.CANCELLING ? 'CANCEL_IN_TRANSIT' : 'CANCEL_BY_CUSTOMER';

    budget.left -= 1;

    const outcome = await sendDispatch({
      kind,
      orderId: order.id,
      entryId: entry.id,
      recipient,
      card: buildCardData(cardKind, order, entry),
      label: `${kind === DISPATCH_KINDS.RETURN ? 'Возврат' : 'Отмена'}: ${entryName(entry)}`,
      eventOrder: { id: order.id, code: order.code, placedAt: order.placedAt, createdAt: order.createdAt },
      settings,
    });

    if (outcome === 'sent') {
      if (kind === DISPATCH_KINDS.RETURN) stats.returnSent += 1;
      else stats.cancelSent += 1;
    }
    if (outcome === 'failed') stats.failed += 1;

    await new Promise((resolve) => setTimeout(resolve, SEND_PAUSE_MS));
  }
}

function snapshotRecipient(dispatch: {
  recipient: Recipient['kind'] | null;
  supplierId: string | null;
  warehouseId: string | null;
  recipientName: string | null;
  chatId: string | null;
}): Recipient | null {
  const { recipientName: name, chatId } = dispatch;

  if (!name || !chatId) return null;

  if (dispatch.recipient === 'SUPPLIER' && dispatch.supplierId) {
    return { kind: 'SUPPLIER', supplierId: dispatch.supplierId, warehouseId: null, name, chatId };
  }

  if (dispatch.recipient === 'WAREHOUSE' && dispatch.warehouseId) {
    return { kind: 'WAREHOUSE', supplierId: null, warehouseId: dispatch.warehouseId, name, chatId };
  }

  // Заказ ушёл разработчику — отмена и возврат туда же: поставщик о нём не знает.
  if (dispatch.recipient === 'DEVELOPER') {
    return { kind: 'DEVELOPER', supplierId: null, warehouseId: null, name, chatId };
  }

  return null;
}
