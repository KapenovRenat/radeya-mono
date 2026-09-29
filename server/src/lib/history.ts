import type {
  AuditAction,
  AuthUser,
  HistoryChange,
  HistoryContext,
  HistoryEntityType,
  HistoryField,
  HistorySource,
} from '@radeya/shared';

import type { Prisma } from '../generated/prisma/client';

/**
 * История изменений: кто, когда и откуда поменял поля сущности.
 *
 * Пишется в ту же таблицу `AuditLog`, что и журнал действий, но по другим
 * правилам — и поэтому отдельной функцией, а не через `logAction()`:
 *
 * - **в транзакции самого изменения.** `logAction()` вызывается после операции
 *   и проглатывает сбой — для журнала входов это правильно, для истории нет:
 *   цена поменялась, а запись не легла, и никто об этом не узнает. Здесь сбой
 *   записи откатывает и само изменение.
 * - **по записи на сущность**, а не одна на весь импорт: в карточке товара должно
 *   быть видно, что закупку ему поставил именно импорт.
 * - **только изменившиеся поля**: список собирает `diffFields()`, а не человек —
 *   руками однажды забудут поле, и история соврёт.
 *
 * Событие без изменённых полей (вход в систему, предпросмотр) — это журнал
 * действий, ему по-прежнему `logAction()`.
 */

export type HistoryAuthor = Pick<AuthUser, 'id' | 'login' | 'role'>;

/**
 * Автор записей, у которых нет человека: синхронизация по расписанию.
 * `userLogin` в журнале обязателен, а выдумывать сотрудника нельзя.
 */
const SYSTEM_AUTHOR = { login: 'system', role: 'SYSTEM' } as const;

export interface HistoryEntry {
  /** Что за событие: значение из AUDIT_ACTIONS. */
  type: AuditAction;
  entityType: HistoryEntityType;
  entityId: string;
  /** Изменённые поля — результат diffFields(). Пустой — запись не пишется. */
  changes: HistoryChange[];
  context?: HistoryContext;
}

export interface HistoryMeta {
  /** Кто. null — синхронизация без человека. */
  author: HistoryAuthor | null;
  source: HistorySource;
  ip?: string | null;
}

/**
 * Запись истории. Возвращает, сколько записей легло.
 *
 * Записи без изменений отбрасываются: «импорт прошёл, ничего не поменял»
 * в карточке товара — это шум, который прячет настоящие правки.
 *
 * Время одно на всю пачку: это одно событие, и в истории разных товаров
 * один импорт должен стоять одной и той же минутой.
 */
export async function recordHistory(
  tx: Prisma.TransactionClient,
  meta: HistoryMeta,
  entries: HistoryEntry[],
): Promise<number> {
  const rows = entries.filter((entry) => entry.changes.length > 0);

  if (rows.length === 0) return 0;

  const at = new Date();

  await tx.auditLog.createMany({
    data: rows.map((entry) => ({
      at,
      userId: meta.author?.id ?? null,
      userLogin: meta.author?.login ?? SYSTEM_AUTHOR.login,
      userRole: meta.author?.role ?? SYSTEM_AUTHOR.role,
      action: entry.type,
      entityType: entry.entityType,
      entityId: entry.entityId,
      source: meta.source,
      changes: entry.changes.map((change) => ({
        field: change.field, from: change.from, to: change.to,
      })),
      context: entry.context === undefined ? undefined : { ...entry.context },
      ip: meta.ip ?? null,
    })),
  });

  return rows.length;
}

/**
 * Что изменилось: поля из `after`, чьё значение отличается от `before`.
 *
 * Сравниваются только поля, переданные в `after`, — то, что записывается
 * сейчас. Поле, которого в `after` нет или оно `undefined`, не трогается
 * и в историю не попадает. `null` в `after` — явная очистка и попадает.
 *
 * `before === null` — сущности (или строки склада) ещё не было: все значения
 * `after` идут как новые.
 *
 * Значения сравниваются уже приведёнными к строке: иначе `Decimal("150000")`
 * из базы и `"150000.00"` из формы окажутся «разными», и каждая правка
 * без изменений ляжет в историю.
 */
export function diffFields<E extends HistoryEntityType>(
  _entityType: E,
  before: Partial<Record<HistoryField<E>, unknown>> | null,
  after: Partial<Record<HistoryField<E>, unknown>>,
): HistoryChange[] {
  const changes: HistoryChange[] = [];

  for (const field of Object.keys(after) as HistoryField<E>[]) {
    if (after[field] === undefined) continue;

    const to = historyValue(after[field]);
    const from = before === null ? null : historyValue(before[field]);

    if (from !== to) changes.push({ field, from, to });
  }

  return changes;
}

/**
 * Значение поля строкой для истории.
 *
 * Деньги (`Decimal`) — с двумя знаками, как их отдаёт API: закупка
 * из базы и закупка из файла должны совпасть как строки.
 */
export function historyValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return value.toISOString();
  if (isDecimal(value)) return value.toFixed(2);

  return JSON.stringify(value);
}

function isDecimal(value: unknown): value is { toFixed: (digits: number) => string } {
  return typeof value === 'object' && value !== null
    && typeof (value as { toFixed?: unknown }).toFixed === 'function';
}
