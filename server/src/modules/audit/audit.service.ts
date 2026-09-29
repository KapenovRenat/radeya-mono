import {
  HISTORY_SOURCES,
  type AuditLogEntry,
  type HistoryChange,
  type HistoryContext,
  type HistorySource,
  type PaginatedResponse,
} from '@radeya/shared';

import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../db/client';
import type { AuditQueryInput } from './audit.schemas';

export const AUDIT_PAGE_SIZE = 50;

/**
 * Страница журнала, новые сверху. С фильтром по сущности — это история
 * одного товара для его карточки.
 *
 * Пагинация обязательна с самого начала: журнал растёт непрерывно и через
 * полгода отдать его целиком будет нельзя.
 */
export async function listAuditLog(
  input: AuditQueryInput,
): Promise<PaginatedResponse<AuditLogEntry>> {
  const where: Prisma.AuditLogWhereInput = {
    ...(input.entityType !== undefined
      ? { entityType: input.entityType, entityId: input.entityId }
      : {}),
    ...(input.action !== undefined ? { action: input.action } : {}),
  };

  const [total, records] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      // `id` вторым ключом: у записей одного импорта время одно,
      // и без него порядок между страницами не определён.
      orderBy: [{ at: 'desc' }, { id: 'asc' }],
      skip: (input.page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
    }),
  ]);

  return {
    items: records.map((record) => ({
      id: record.id,
      at: record.at.toISOString(),
      userId: record.userId,
      userLogin: record.userLogin,
      userRole: record.userRole,
      action: record.action,
      entityType: record.entityType,
      entityId: record.entityId,
      source: readSource(record.source),
      changes: readChanges(record.changes),
      context: readContext(record.context),
    })),
    total,
    page: input.page,
    pageSize: AUDIT_PAGE_SIZE,
  };
}

function readSource(value: string | null): HistorySource | null {
  return value !== null && value in HISTORY_SOURCES ? (value as HistorySource) : null;
}

/**
 * Json из базы формы не гарантирует: запись могла лечь до того, как форма
 * устоялась. Кривой элемент пропускаем, а не роняем всю страницу истории.
 */
function readChanges(value: Prisma.JsonValue): HistoryChange[] {
  if (!Array.isArray(value)) return [];

  const changes: HistoryChange[] = [];

  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;

    const { field, from, to } = item as Record<string, unknown>;

    if (typeof field !== 'string') continue;

    changes.push({ field, from: asText(from), to: asText(to) });
  }

  return changes;
}

const CONTEXT_KEYS = ['warehouse', 'document', 'sheet', 'note'] as const satisfies
  readonly (keyof HistoryContext)[];

function readContext(value: Prisma.JsonValue): HistoryContext | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const context: HistoryContext = {};

  for (const key of CONTEXT_KEYS) {
    const text = asText((value as Record<string, unknown>)[key]);

    if (text !== null) context[key] = text;
  }

  return Object.keys(context).length > 0 ? context : null;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
