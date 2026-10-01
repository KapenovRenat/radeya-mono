import { SALES_POINT_TYPES, WORKER_EVENT_TYPES, WORKER_KEYS } from '@radeya/shared';

import { prisma } from '../../../../db/client';
import { loadKaspiEntries } from '../../../orders/order-details.service';
import { findRecentWorkerEvents, recordWorkerEvent } from '../../engine/worker-events.service';
import { FAILURE_REPEAT_MS } from '../../engine/worker.constants';
import { ENTRIES_PAUSE_MS, ENTRIES_PER_RUN } from './orders.constants';

/**
 * Шаг 2. Состав заказов Kaspi за период, у которых его ещё нет, — по нему
 * ищется поставщик. Свежие первыми и не больше ENTRIES_PER_RUN за цикл:
 * запрос на заказ, а после первого включения таких заказов могут быть
 * сотни — дотянутся за несколько циклов.
 */
export async function loadEntriesStep(
  from: Date,
  signal: AbortSignal,
): Promise<{ entriesLoaded: number; entriesFailed: number }> {
  const orders = await prisma.order.findMany({
    where: {
      placedAt: { gte: from },
      kaspiId: { not: null },
      salesPoint: { type: SALES_POINT_TYPES.KASPI },
      entries: { none: {} },
    },
    select: { id: true, code: true, placedAt: true, createdAt: true },
    orderBy: { placedAt: 'desc' },
    take: ENTRIES_PER_RUN,
  });

  if (orders.length === 0) return { entriesLoaded: 0, entriesFailed: 0 };

  // Заказ, который не грузится, будет пробоваться каждый цикл — а в журнал
  // попадёт раз в час, а не тридцать раз.
  const { orderIds: recentlyFailed } = await findRecentWorkerEvents(
    WORKER_EVENT_TYPES.ORDER_ENTRIES_FAILED, FAILURE_REPEAT_MS, orders.map((order) => order.id),
  );
  let entriesLoaded = 0;
  let entriesFailed = 0;

  for (const order of orders) {
    signal.throwIfAborted();

    try {
      const { names } = await loadKaspiEntries(order.id);

      entriesLoaded += 1;
      await recordWorkerEvent(WORKER_KEYS.ORDERS, {
        type: WORKER_EVENT_TYPES.ORDER_ENTRIES_LOADED,
        message: names.length === 0 ? 'Kaspi не вернул позиций' : `Состав: ${names.join(', ')}`,
        details: { items: names },
        order,
      });
    } catch (error) {
      entriesFailed += 1;

      if (!recentlyFailed.has(order.id)) {
        await recordWorkerEvent(WORKER_KEYS.ORDERS, {
          type: WORKER_EVENT_TYPES.ORDER_ENTRIES_FAILED,
          message: error instanceof Error ? error.message : 'неизвестная ошибка',
          order,
        });
      }
    }

    await new Promise((resolve) => setTimeout(resolve, ENTRIES_PAUSE_MS));
  }

  return { entriesLoaded, entriesFailed };
}
