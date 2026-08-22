"use client";

import { AUDIT_ACTION_LABELS, type AuditAction } from "@radeya/shared";

import { useGetAuditLogQuery } from "@/features/audit/audit-api";
import { formatDateTime } from "@/lib/format";

/** Читаемая подпись действия. Неизвестный код показываем как есть, а не прячем. */
function actionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action as AuditAction] ?? action;
}

/** История действий. Только чтение: записи не редактируются и не удаляются. */
export function AuditTable() {
  const { data, isLoading, isError } = useGetAuditLogQuery();

  if (isLoading) return <p className="text-sm text-muted-foreground">Загружаю…</p>;

  if (isError)
    return <p className="text-sm text-destructive">Не удалось загрузить историю</p>;

  const entries = data?.items ?? [];

  if (entries.length === 0)
    return <p className="text-sm text-muted-foreground">Записей пока нет</p>;

  return (
    <table className="w-full text-left text-sm">
      <thead className="text-muted-foreground">
        <tr>
          <th className="py-2 font-medium">Кто</th>
          <th className="py-2 font-medium">Когда</th>
          <th className="py-2 font-medium">Что сделал</th>
        </tr>
      </thead>

      <tbody>
        {entries.map((entry) => (
          <tr key={entry.id} className="border-t">
            <td className="py-2">{entry.userLogin}</td>
            <td className="py-2">{formatDateTime(entry.at)}</td>
            <td className="py-2">{actionLabel(entry.action)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
