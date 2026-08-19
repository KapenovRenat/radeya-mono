"use client";

import { useGetHealthQuery } from "@/features/health/health-api";

/**
 * Временная страница: проверяет, что фронт видит API.
 * Заменится настоящим дашбордом на этапе аналитики.
 */
export default function DashboardPage() {
  const { data, isLoading, isError } = useGetHealthQuery();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="rounded-lg border p-4 text-sm">
        <div className="mb-2 font-medium">Связь с API</div>

        {isLoading && <p className="text-muted-foreground">Проверяю…</p>}

        {isError && (
          <p className="text-destructive">
            API недоступен. Запущен ли сервер на порту 4000?
          </p>
        )}

        {data && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Статус</dt>
            <dd>{data.status}</dd>
            <dt className="text-muted-foreground">Окружение</dt>
            <dd>{data.environment}</dd>
            <dt className="text-muted-foreground">База данных</dt>
            <dd>{data.database}</dd>
            <dt className="text-muted-foreground">Аптайм</dt>
            <dd>{data.uptimeSeconds} с</dd>
          </dl>
        )}
      </div>
    </div>
  );
}
