import type { Request } from 'express';
import type { AuditAction } from '@radeya/shared';

import { prisma } from '../db/client';
import { logger } from './logger';

interface LogActionInput {
  /** Кто. Пусто — только для действий до входа, например неудачной попытки. */
  userId?: string | null;
  /** Логин и роль записываются снимком: после смены роли история не должна поехать. */
  userLogin: string;
  userRole: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

/**
 * Запись в журнал действий. Вызывается отовсюду, где что-то меняется:
 * вход, создание сотрудника, смена роли, правка цены, синхронизация с Kaspi.
 *
 * Ошибка записи не роняет основную операцию — иначе сбой журнала обрушил бы
 * работу системы. Проблема уходит в логгер, действие всё равно проходит.
 */
export async function logAction(input: LogActionInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        userLogin: input.userLogin,
        userRole: input.userRole,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        before: toJson(input.before),
        after: toJson(input.after),
        ip: input.ip ?? null,
      },
    });
  } catch (error) {
    logger.error('Не удалось записать действие в журнал', error);
  }
}

/** Prisma ждёт валидный JSON или null, undefined её не устраивает. */
function toJson(value: unknown) {
  if (value === undefined || value === null) return undefined;
  return value as object;
}

/**
 * IP клиента. За обратным прокси реальный адрес приходит в X-Forwarded-For,
 * поэтому на сервере обязательно включить trust proxy, иначе тут будет адрес прокси.
 */
export function clientIp(req: Request): string | null {
  return req.ip ?? null;
}
