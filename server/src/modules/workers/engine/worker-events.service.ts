import type { WorkerEventType, WorkerKey } from '@radeya/shared';

import { prisma } from '../../../db/client';
import type { Prisma } from '../../../generated/prisma/client';
import { logger } from '../../../lib/logger';

/** Заказ, к которому относится событие, — копией, журнал должен остаться как был. */
export interface WorkerEventOrder {
  id: string;
  code: string;
  placedAt: Date;
  createdAt: Date;
}

export interface WorkerEventInput {
  type: WorkerEventType;
  message: string;
  details?: Prisma.InputJsonValue;
  order?: WorkerEventOrder;
}

/**
 * Запись событий журнала. Сбой записи не роняет цикл: журнал важен, но
 * остановить из-за него получение заказов было бы хуже. Сбой — в лог сервера.
 */
export async function recordWorkerEvents(
  workerKey: WorkerKey,
  events: WorkerEventInput[],
): Promise<void> {
  if (events.length === 0) return;

  try {
    await prisma.workerEvent.createMany({
      data: events.map((event) => ({
        workerKey,
        type: event.type,
        message: event.message,
        details: event.details,
        orderId: event.order?.id ?? null,
        orderCode: event.order?.code ?? null,
        orderPlacedAt: event.order?.placedAt ?? null,
        orderCreatedAt: event.order?.createdAt ?? null,
      })),
    });
  } catch (error) {
    logger.error(`Воркер ${workerKey}: не удалось записать ${events.length} событий в журнал`, error);
  }
}

export async function recordWorkerEvent(workerKey: WorkerKey, event: WorkerEventInput): Promise<void> {
  await recordWorkerEvents(workerKey, [event]);
}

/**
 * Было ли такое событие недавно — чтобы повторяющийся сбой попадал в журнал
 * раз в час, а не каждый цикл. `orderIds` не задан — событие без заказа;
 * задан — возвращаются заказы, по которым оно уже было.
 */
export async function findRecentWorkerEvents(
  type: WorkerEventType,
  withinMs: number,
  orderIds?: string[],
): Promise<{ any: boolean; orderIds: Set<string> }> {
  const rows = await prisma.workerEvent.findMany({
    where: {
      type,
      at: { gte: new Date(Date.now() - withinMs) },
      orderId: orderIds === undefined ? null : { in: orderIds },
    },
    select: { orderId: true },
    take: orderIds === undefined ? 1 : undefined,
  });

  return {
    any: rows.length > 0,
    orderIds: new Set(rows.map((row) => row.orderId).filter((id): id is string => id !== null)),
  };
}
