import { WORKER_KEYS } from '@radeya/shared';

import { LOCKS } from '../../../../lib/advisory-lock';
import type { WorkerJob } from '../../engine/worker-engine';
import { arrivalDatesStep } from './arrival-dates.step';
import { dispatchStep } from './dispatch/dispatch.step';
import { loadEntriesStep } from './load-entries.step';
import { syncOrdersStep } from './sync-orders.step';

/**
 * Воркер заказов `ORDERS` — docs/workers.md. Один цикл — шаги по порядку,
 * каждый в своём файле этой папки:
 *
 * 1. Заказы Kaspi за период → база, изменения — в журнал (sync-orders.step.ts).
 * 2. Состав новых заказов — по нему ищется поставщик (load-entries.step.ts).
 * 3. «Планируемая дата прибытия» из кабинета (arrival-dates.step.ts).
 * 4. Отправка в Telegram — поставщикам и в группу Астаны (dispatch/).
 */
export const ordersJob: WorkerJob = {
  key: WORKER_KEYS.ORDERS,
  lockKey: LOCKS.KASPI_ORDERS_SYNC,

  async run({ settings, signal }) {
    const to = new Date();
    const from = monthsBefore(to, settings.periodMonths);

    const synced = await syncOrdersStep(from, to, signal);
    const entries = await loadEntriesStep(from, signal);
    const dates = await arrivalDatesStep(settings, signal);
    const dispatched = await dispatchStep(settings, signal);

    return { ...synced, ...entries, ...dates, ...dispatched };
  },
};

/** Тот же день N месяцев назад: «за месяц» — с 1 октября по 1 ноября, а не 30 дней. */
function monthsBefore(date: Date, months: number): Date {
  const result = new Date(date);

  result.setMonth(result.getMonth() - months);

  return result;
}
