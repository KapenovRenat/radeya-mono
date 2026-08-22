import type { AuditLogEntry, PaginatedResponse } from '@radeya/shared';

import { prisma } from '../../db/client';

export const AUDIT_PAGE_SIZE = 50;

/**
 * Страница журнала действий, новые сверху.
 *
 * Пагинация обязательна с самого начала: журнал растёт непрерывно и через
 * полгода отдать его целиком будет нельзя.
 */
export async function listAuditLog(
  page: number,
): Promise<PaginatedResponse<AuditLogEntry>> {
  const currentPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const [total, records] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      orderBy: { at: 'desc' },
      skip: (currentPage - 1) * AUDIT_PAGE_SIZE,
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
    })),
    total,
    page: currentPage,
    pageSize: AUDIT_PAGE_SIZE,
  };
}
