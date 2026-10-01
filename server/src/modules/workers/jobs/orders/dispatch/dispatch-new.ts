import {
  DISPATCH_KINDS,
  ORDER_DELIVERY_TYPES,
  ORDER_STATUS_LABELS,
  SALES_POINT_TYPES,
  WORKER_EVENT_TYPES,
  WORKER_KEYS,
} from '@radeya/shared';

import { prisma } from '../../../../../db/client';
import type { WorkerSettings } from '../../../../../generated/prisma/client';
import { logger } from '../../../../../lib/logger';
import { refreshOrderCabinet } from '../../../../orders/order-cabinet.service';
import { findRecentWorkerEvents, recordWorkerEvent } from '../../../engine/worker-events.service';
import { FAILURE_REPEAT_MS } from '../../../engine/worker.constants';
import {
  buildCardData,
  dispatchEntrySelect,
  dispatchOrderSelect,
  entryName,
  type DispatchOrder,
} from './dispatch-data';
import {
  ARRIVAL_DATE_FRESH_MS,
  CLOSED_BEFORE_SEND,
  MAX_ORDERS_PER_RUN,
  SEND_PAUSE_MS,
} from './dispatch.constants';
import { resolveRecipient } from './recipients';
import { sendDispatch } from './send-dispatch';

/** Отправка завершена тем или иным образом — второй раз позицию не трогаем. */
const FINAL_STATUSES = ['SENT', 'SKIPPED', 'FAILED'] as const;

export interface DispatchBudget {
  /** Сколько сообщений ещё можно отправить в этом цикле. */
  left: number;
}

export interface NewOrdersStats {
  sent: number;
  skipped: number;
  waitingDate: number;
  noRecipient: number;
  failed: number;
}

/**
 * Новые заказы: оформлены после точки отсечки, прошла задержка, есть позиции,
 * которые ещё не ушли. Старые первыми.
 *
 * - заказ закрылся до отправки → позиции помечаются «не отправлено», ничего не шлём;
 * - Kaspi Доставка без даты сдачи → ждём следующего цикла (решение пользователя);
 * - некому слать (нет Telegram ID, нет поставщика) → в журнал, повтор в следующем
 *   цикле: поправят настройки — уйдёт без перезапуска;
 * - иначе — по карточке на позицию.
 */
export async function dispatchNewOrders(
  settings: WorkerSettings,
  cutoff: Date,
  budget: DispatchBudget,
  signal: AbortSignal,
): Promise<NewOrdersStats> {
  const stats: NewOrdersStats = { sent: 0, skipped: 0, waitingDate: 0, noRecipient: 0, failed: 0 };
  const now = Date.now();

  const orders = await prisma.order.findMany({
    where: {
      salesPoint: { type: SALES_POINT_TYPES.KASPI },
      placedAt: { gte: cutoff, lte: new Date(now - settings.supplierNotifyDelayMinutes * 60_000) },
      entries: {
        some: {
          entryNumber: { gte: 0 },
          dispatches: { none: { kind: DISPATCH_KINDS.NEW, status: { in: [...FINAL_STATUSES] } } },
        },
      },
    },
    select: {
      ...dispatchOrderSelect,
      entries: {
        // Заглушка «Kaspi вернул пусто» — не позиция.
        where: { entryNumber: { gte: 0 } },
        select: {
          ...dispatchEntrySelect,
          dispatches: { where: { kind: DISPATCH_KINDS.NEW }, select: { status: true } },
        },
        orderBy: { entryNumber: 'asc' },
      },
    },
    orderBy: { placedAt: 'asc' },
    take: MAX_ORDERS_PER_RUN,
  });

  if (orders.length === 0) return stats;

  const orderIds = orders.map((order) => order.id);
  const waitingLogged = await findRecentWorkerEvents(WORKER_EVENT_TYPES.DISPATCH_WAITING_DATE, FAILURE_REPEAT_MS, orderIds);
  const noRecipientLogged = await findRecentWorkerEvents(WORKER_EVENT_TYPES.DISPATCH_NO_RECIPIENT, FAILURE_REPEAT_MS, orderIds);

  for (const order of orders) {
    if (budget.left <= 0) break;
    signal.throwIfAborted();

    const eventOrder = { id: order.id, code: order.code, placedAt: order.placedAt, createdAt: order.createdAt };
    const pending = order.entries.filter((entry) =>
      !entry.dispatches.some((dispatch) => (FINAL_STATUSES as readonly string[]).includes(dispatch.status)));

    if (CLOSED_BEFORE_SEND.includes(order.status)) {
      await skipEntries(order.id, pending.map((entry) => entry.id), ORDER_STATUS_LABELS[order.status]);
      await recordWorkerEvent(WORKER_KEYS.ORDERS, {
        type: WORKER_EVENT_TYPES.DISPATCH_SKIPPED,
        message: `Не отправлен: заказ уже «${ORDER_STATUS_LABELS[order.status]}» до отправки`,
        order: eventOrder,
      });
      stats.skipped += pending.length;
      continue;
    }

    const ready = await ensureHandoverDate(order);

    if (!ready) {
      stats.waitingDate += 1;

      if (!waitingLogged.orderIds.has(order.id)) {
        await recordWorkerEvent(WORKER_KEYS.ORDERS, {
          type: WORKER_EVENT_TYPES.DISPATCH_WAITING_DATE,
          message: 'Kaspi Доставка без даты сдачи — без неё не отправляем, ждём кабинет',
          order: eventOrder,
        });
      }

      continue;
    }

    for (const entry of pending) {
      if (budget.left <= 0) break;
      signal.throwIfAborted();

      const resolved = resolveRecipient(order, entry);

      if ('problem' in resolved) {
        stats.noRecipient += 1;

        if (!noRecipientLogged.orderIds.has(order.id)) {
          await recordWorkerEvent(WORKER_KEYS.ORDERS, {
            type: WORKER_EVENT_TYPES.DISPATCH_NO_RECIPIENT,
            message: `${entryName(entry)}: ${resolved.problem}`,
            order: eventOrder,
          });
        }

        continue;
      }

      budget.left -= 1;

      const outcome = await sendDispatch({
        kind: DISPATCH_KINDS.NEW,
        orderId: order.id,
        entryId: entry.id,
        recipient: resolved.recipient,
        card: buildCardData('NEW', order, entry),
        label: `Заказ: ${entryName(entry)}`,
        eventOrder,
        settings,
      });

      if (outcome === 'sent') stats.sent += 1;
      if (outcome === 'failed') stats.failed += 1;

      await pause(SEND_PAUSE_MS);
    }
  }

  return stats;
}

/**
 * Дата сдачи для Kaspi Доставки — свежая из кабинета перед отправкой.
 * Своей доставке и самовывозу она не нужна. Кабинет не ответил — берём
 * то, что уже есть; нет и этого — ждём.
 */
async function ensureHandoverDate(order: DispatchOrder): Promise<boolean> {
  if (order.deliveryType !== ORDER_DELIVERY_TYPES.KASPI) return true;

  const fresh = order.cabinetSyncedAt !== null
    && Date.now() - order.cabinetSyncedAt.getTime() < ARRIVAL_DATE_FRESH_MS;

  if (!fresh) {
    try {
      const result = await refreshOrderCabinet(order.id);

      order.plannedPointDeliveryAt = result.after;
    } catch (error) {
      logger.warn(`Отправка: дата сдачи заказа ${order.code} не обновилась`, error);
    }
  }

  return order.plannedPointDeliveryAt !== null;
}

/** «Не отправлено» по позициям: создать или закрыть ждущие повтора. */
async function skipEntries(orderId: string, entryIds: string[], reason: string): Promise<void> {
  for (const entryId of entryIds) {
    await prisma.orderDispatch.upsert({
      where: { entryId_kind: { entryId, kind: DISPATCH_KINDS.NEW } },
      create: { orderId, entryId, kind: DISPATCH_KINDS.NEW, status: 'SKIPPED', lastError: `Закрыт до отправки: ${reason}` },
      update: { status: 'SKIPPED', lastError: `Закрыт до отправки: ${reason}` },
    });
  }
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
