import { WORKER_EVENT_TYPES, WORKER_KEYS } from '@radeya/shared';

import type { WorkerSettings } from '../../../../generated/prisma/client';
import { formatAstanaDayWithYear } from '../../../../lib/astana-time';
import { refreshDueOrdersCabinet } from '../../../orders/order-cabinet.service';
import { alertDeveloper } from '../../engine/worker-alerts';
import { findRecentWorkerEvents, recordWorkerEvent } from '../../engine/worker-events.service';
import { FAILURE_REPEAT_MS } from '../../engine/worker.constants';

/**
 * Шаг 3. «Планируемая дата прибытия» из кабинета — активным заказам, новые первыми.
 *
 * Кабинет недоступен целиком (вход, сессия, сеть) — цикл не валим: заказы
 * из Shop API уже записаны, а это главное. Пишем в журнал и сообщаем
 * разработчику — раз в час, а не каждый цикл.
 */
export async function arrivalDatesStep(
  settings: WorkerSettings,
  signal: AbortSignal,
): Promise<{ cabinetChecked: number; arrivalDateChanged: number }> {
  try {
    const result = await refreshDueOrdersCabinet({
      signal,
      onResult: async (refreshed) => {
        if (!refreshed.found || refreshed.before?.getTime() === refreshed.after?.getTime()) return;

        await recordWorkerEvent(WORKER_KEYS.ORDERS, {
          type: WORKER_EVENT_TYPES.ORDER_ARRIVAL_DATE_CHANGED,
          message: `Дата прибытия: ${formatAstanaDayWithYear(refreshed.before)} → `
            + formatAstanaDayWithYear(refreshed.after),
          details: { from: refreshed.before?.toISOString() ?? null, to: refreshed.after?.toISOString() ?? null },
          order: refreshed.order,
        });
      },
      // Повтор по такому заказу — через час: refreshDueOrdersCabinet отметила его опрошенным.
      onOrderFailed: async (order, error) => {
        await recordWorkerEvent(WORKER_KEYS.ORDERS, {
          type: WORKER_EVENT_TYPES.ORDER_CABINET_FAILED, message: error.message, order,
        });
      },
    });

    return { cabinetChecked: result.processed, arrivalDateChanged: result.changed };
  } catch (error) {
    if (signal.aborted) throw error;

    const message = `Кабинет Kaspi недоступен: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`;
    const recent = await findRecentWorkerEvents(WORKER_EVENT_TYPES.ORDER_CABINET_FAILED, FAILURE_REPEAT_MS);

    if (!recent.any) {
      await recordWorkerEvent(WORKER_KEYS.ORDERS, { type: WORKER_EVENT_TYPES.ORDER_CABINET_FAILED, message });
      await alertDeveloper(WORKER_KEYS.ORDERS, settings, `${message}. Даты прибытия не обновляются`);
    }

    return { cabinetChecked: 0, arrivalDateChanged: 0 };
  }
}
