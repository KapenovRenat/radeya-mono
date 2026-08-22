/**
 * Запись журнала действий в том виде, в каком уходит наружу.
 *
 * `userLogin` и `userRole` — снимок на момент действия, а не текущие значения.
 * Поэтому в журнале они строки, а не ссылка на пользователя.
 */
export interface AuditLogEntry {
  id: string;
  /** ISO-строка. */
  at: string;
  userId: string | null;
  userLogin: string;
  userRole: string;
  /** Значение из AUDIT_ACTIONS; подпись — в AUDIT_ACTION_LABELS. */
  action: string;
  entityType: string | null;
  entityId: string | null;
}
