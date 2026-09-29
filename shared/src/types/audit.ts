import type { HistorySource } from '../constants/history-fields';
import type { HistoryChange, HistoryContext } from './history';

/**
 * Запись журнала действий в том виде, в каком уходит наружу.
 *
 * `userLogin` и `userRole` — снимок на момент действия, а не текущие значения.
 * Поэтому в журнале они строки, а не ссылка на пользователя.
 *
 * Журнал и история изменений — одна таблица. У записи истории заполнены
 * `source` и `changes`, у записи журнала действий они пусты.
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
  /** Откуда изменение. null — запись журнала действий. */
  source: HistorySource | null;
  /** Изменённые поля. Пустой массив — запись журнала действий. */
  changes: HistoryChange[];
  context: HistoryContext | null;
}

/** Параметры GET /api/audit. Без фильтров — весь журнал. */
export interface AuditLogQuery {
  page?: number;
  /** История одной сущности: `Variant` + id. Передаются только вместе. */
  entityType?: string;
  entityId?: string;
  /** Значение из AUDIT_ACTIONS. */
  action?: string;
}
