import {
  ORDER_STATUS_LABELS,
  SALES_POINT_TYPES,
  WORKER_EVENT_TYPES,
  WORKER_KEYS,
} from '@radeya/shared';

import { prisma } from '../../db/client';
import type { WorkerSettings } from '../../generated/prisma/client';
import { LOCKS } from '../../lib/advisory-lock';
import { refreshDueOrdersCabinet } from '../orders/order-cabinet.service';
import { loadKaspiEntries } from '../orders/order-details.service';
import { syncKaspiOrdersPeriod, type OrderChange } from '../orders/orders.service';
import { alertDeveloper } from './worker-alerts';
import type { WorkerJob } from './worker-engine';
import { recordWorkerEvent, recordWorkerEvents, type WorkerEventInput } from './worker-events.service';
import { ENTRIES_FAILURE_REPEAT_MS, ENTRIES_PAUSE_MS, ENTRIES_PER_RUN } from './worker.constants';

/**
 * Воркер заказов, docs/workers.md:
 *
 * 1. Заказы Kaspi за период из настроек → база; новые и сменившие стадию — в журнал.
 * 2. Состав новых заказов — по нему ищется поставщик.
 * 3. «Планируемая дата прибытия» из кабинета — активным заказам.
 *
 * Отправка в Telegram — этап 3, добавится четвёртым шагом.
 */
export const ordersJob: WorkerJob = {
  key: WORKER_KEYS.ORDERS,
  lockKey: LOCKS.KASPI_ORDERS_SYNC,

  async run({ settings, signal }) {
    const to = new Date();
    const from = monthsBefore(to, settings.periodMonths);
    let statusChanged = 0;

    const stats = await syncKaspiOrdersPeriod(from.getTime(), to.getTime(), {
      signal,
      onChanges: async (changes) => {
        statusChanged += changes.filter((change) => change.kind === 'status').length;
        await recordWorkerEvents(WORKER_KEYS.ORDERS, changes.map(toChangeEvent));
      },
    });

    const entries = await loadMissingEntries(from, signal);
    const cabinet = await refreshCabinetDates(settings, signal);

    return {
      ordersSeen: stats.ordersSeen,
      created: stats.created,
      statusChanged,
      entriesLoaded: entries.loaded,
      entriesFailed: entries.failed,
      cabinetChecked: cabinet.processed,
      arrivalDateChanged: cabinet.changed,
      syncMs: stats.tookMs,
    };
  },
};

/**
 * «Планируемая дата прибытия» из кабинета — активным заказам, новые первыми.
 *
 * Кабинет недоступен целиком (вход, сессия, сеть) — цикл не валим: заказы
 * из Shop API уже записаны, а это главное. Пишем в журнал и сообщаем
 * разработчику — раз в час, а не каждый цикл.
 */
async function refreshCabinetDates(
  settings: WorkerSettings,
  signal: AbortSignal,
): Promise<{ processed: number; changed: number }> {
  try {
    return await refreshDueOrdersCabinet({
      signal,
      onResult: async (result) => {
        if (!result.found || result.before?.getTime() === result.after?.getTime()) return;

        await recordWorkerEvent(WORKER_KEYS.ORDERS, {
          type: WORKER_EVENT_TYPES.ORDER_ARRIVAL_DATE_CHANGED,
          message: `Дата прибытия: ${formatDay(result.before)} → ${formatDay(result.after)}`,
          details: { from: result.before?.toISOString() ?? null, to: result.after?.toISOString() ?? null },
          order: result.order,
        });
      },
      // Повтор по такому заказу — через час: refreshDueOrdersCabinet отметила его опрошенным.
      onOrderFailed: async (order, error) => {
        await recordWorkerEvent(WORKER_KEYS.ORDERS, {
          type: WORKER_EVENT_TYPES.ORDER_CABINET_FAILED, message: error.message, order,
        });
      },
    });
  } catch (error) {
    if (signal.aborted) throw error;

    const message = `Кабинет Kaspi недоступен: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`;

    if (!(await hasRecentEvent(WORKER_EVENT_TYPES.ORDER_CABINET_FAILED, ENTRIES_FAILURE_REPEAT_MS))) {
      await recordWorkerEvent(WORKER_KEYS.ORDERS, { type: WORKER_EVENT_TYPES.ORDER_CABINET_FAILED, message });
      await alertDeveloper(WORKER_KEYS.ORDERS, settings, `${message}. Даты прибытия не обновляются`);
    }

    return { processed: 0, changed: 0 };
  }
}

/** Было ли такое событие без заказа за последнее время — чтобы не повторять его каждый цикл. */
async function hasRecentEvent(type: string, withinMs: number): Promise<boolean> {
  const found = await prisma.workerEvent.findFirst({
    where: { type, orderId: null, at: { gte: new Date(Date.now() - withinMs) } },
    select: { id: true },
  });

  return found !== null;
}

/** Дата прибытия Kaspi держит как конец дня — показываем только день, по Астане. */
function formatDay(date: Date | null): string {
  if (date === null) return '—';

  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Almaty', day: 'numeric', month: 'short', year: 'numeric',
  }).format(date);
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

/**
 * Состав заказов Kaspi за период, у которых его ещё нет. Свежие первыми
 * и не больше ENTRIES_PER_RUN за цикл: запрос на заказ, а после первого
 * включения таких заказов может быть сотни — дотянутся за несколько циклов.
 */
async function loadMissingEntries(
  from: Date,
  signal: AbortSignal,
): Promise<{ loaded: number; failed: number }> {
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

  if (orders.length === 0) return { loaded: 0, failed: 0 };

  const recentlyFailed = await findRecentEntriesFailures(orders.map((order) => order.id));
  let loaded = 0;
  let failed = 0;

  for (const order of orders) {
    signal.throwIfAborted();

    try {
      const { names } = await loadKaspiEntries(order.id);

      loaded += 1;
      await recordWorkerEvent(WORKER_KEYS.ORDERS, {
        type: WORKER_EVENT_TYPES.ORDER_ENTRIES_LOADED,
        message: names.length === 0 ? 'Kaspi не вернул позиций' : `Состав: ${names.join(', ')}`,
        details: { items: names },
        order,
      });
    } catch (error) {
      failed += 1;

      // Заказ, который не грузится, будет пробоваться каждый цикл — а в журнал
      // попадёт раз в час, а не 30 раз.
      if (!recentlyFailed.has(order.id)) {
        await recordWorkerEvent(WORKER_KEYS.ORDERS, {
          type: WORKER_EVENT_TYPES.ORDER_ENTRIES_FAILED,
          message: error instanceof Error ? error.message : 'неизвестная ошибка',
          order,
        });
      }
    }

    await pause(ENTRIES_PAUSE_MS);
  }

  return { loaded, failed };
}

async function findRecentEntriesFailures(orderIds: string[]): Promise<Set<string>> {
  const rows = await prisma.workerEvent.findMany({
    where: {
      orderId: { in: orderIds },
      type: WORKER_EVENT_TYPES.ORDER_ENTRIES_FAILED,
      at: { gte: new Date(Date.now() - ENTRIES_FAILURE_REPEAT_MS) },
    },
    select: { orderId: true },
  });

  return new Set(rows.map((row) => row.orderId).filter((id): id is string => id !== null));
}

/** Тот же день N месяцев назад: «за месяц» — с 1 октября по 1 ноября, а не 30 дней. */
function monthsBefore(date: Date, months: number): Date {
  const result = new Date(date);

  result.setMonth(result.getMonth() - months);

  return result;
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
