import { ORDER_STATUS_LABELS, WORKER_EVENT_TYPES, WORKER_KEYS } from '@radeya/shared';

import { syncKaspiOrdersPeriod, type OrderChange } from '../../../orders/orders.service';
import { recordWorkerEvents, type WorkerEventInput } from '../../engine/worker-events.service';

/**
 * Шаг 1. Заказы Kaspi за период → база. Новые и сменившие стадию — в журнал
 * после каждого отрезка, а не в конце: оборвётся цикл — записанное
 * уже не будет «изменением» в следующем.
 */
export async function syncOrdersStep(
  from: Date,
  to: Date,
  signal: AbortSignal,
): Promise<{ ordersSeen: number; created: number; statusChanged: number; syncMs: number }> {
  let statusChanged = 0;

  const stats = await syncKaspiOrdersPeriod(from.getTime(), to.getTime(), {
    signal,
    onChanges: async (changes) => {
      statusChanged += changes.filter((change) => change.kind === 'status').length;
      await recordWorkerEvents(WORKER_KEYS.ORDERS, changes.map(toChangeEvent));
    },
  });

  return { ordersSeen: stats.ordersSeen, created: stats.created, statusChanged, syncMs: stats.tookMs };
}

function toChangeEvent(change: OrderChange): WorkerEventInput {
  const order = {
    id: change.orderId, code: change.code, placedAt: change.placedAt, createdAt: change.createdAt,
  };

  if (change.kind === 'created') {
    return {
      type: WORKER_EVENT_TYPES.ORDER_CREATED,
      message: `Новый заказ · ${ORDER_STATUS_LABELS[change.toStatus]}`
        + (change.totalPrice === null ? '' : ` · ${change.totalPrice} ₸`),
      details: { status: change.toStatus, totalPrice: change.totalPrice },
      order,
    };
  }

  const fromLabel = change.fromStatus === null ? '—' : ORDER_STATUS_LABELS[change.fromStatus];

  return {
    type: WORKER_EVENT_TYPES.ORDER_STATUS_CHANGED,
    message: `Статус: ${fromLabel} → ${ORDER_STATUS_LABELS[change.toStatus]}`,
    details: { from: change.fromStatus, to: change.toStatus },
    order,
  };
}
