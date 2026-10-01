import type { WorkerEventType, WorkerKey } from '@radeya/shared';

import { prisma } from '../../db/client';
import type { Prisma } from '../../generated/prisma/client';
import { logger } from '../../lib/logger';

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
