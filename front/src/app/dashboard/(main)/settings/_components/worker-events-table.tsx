"use client";

import { useId } from "react";
import { WORKER_EVENT_TYPE_LABELS, type WorkerEventType, type WorkerKey } from "@radeya/shared";

import { Dropdown, type DropdownOption } from "@/components/dropdown";
import { Input } from "@/components/input";
import { Tables } from "@/components/tables";
import { useWorkerEvents } from "@/features/workers/use-worker-events";
import { formatDateTime } from "@/lib/format";

const ALL_TYPES = "";

const TYPE_OPTIONS: DropdownOption[] = [
  { value: ALL_TYPES, label: "Все события" },
  ...(Object.keys(WORKER_EVENT_TYPE_LABELS) as WorkerEventType[])
    .map((type) => ({ value: type, label: WORKER_EVENT_TYPE_LABELS[type] })),
];

const COLUMNS = ["Время", "Событие", "Заказ", "Что сделано", "Получатель", "Telegram ID"] as const;

/**
 * Журнал воркера: что сделал и кому отправил. Свежие сверху, обновляется сам.
 * Разметка минимальная, на общих компонентах — вид дорабатывается отдельно.
 */
export function WorkerEventsTable({ workerKey }: { workerKey: WorkerKey }) {
  const events = useWorkerEvents(workerKey);
  const id = useId();

  return (
    <section className="space-y-2 border-t pt-3" aria-labelledby={id + "-title"}>
      <h4 id={id + "-title"} className="text-sm font-medium">История воркера</h4>

      <div className="flex flex-wrap items-end gap-3">
        <Dropdown
          mode="select"
          searchable
          label="Событие"
          options={TYPE_OPTIONS}
          value={events.type}
          onChange={(next) => events.setType(next as WorkerEventType | "")}
        />

        <Input
          id={id + "-order"}
          label="Номер заказа"
          value={events.orderCode}
          onChange={(event) => events.setOrderCode(event.target.value)}
          placeholder="Можно последние цифры"
          inputMode="numeric"
          autoComplete="off"
        />
      </div>

      <Tables
        page={events.page}
        pageSize={events.pageSize}
        total={events.total}
        onPageChange={events.setPage}
        onPageSizeChange={events.setPageSize}
        isLoading={events.isLoading}
        error={events.error}
        onRetry={events.reload}
        head={<tr>{COLUMNS.map((title) => <th key={title} scope="col">{title}</th>)}</tr>}
        columnCount={COLUMNS.length}
        caption="История воркера"
        emptyLabel="Событий нет"
      >
        {events.items.map((event) => (
          <tr key={event.id}>
            <td>{formatDateTime(event.at)}</td>
            <td>{WORKER_EVENT_TYPE_LABELS[event.type] ?? event.type}</td>
            <td>{event.orderCode ?? "—"}</td>
            <td>{event.message}</td>
            <td>{event.recipientName ?? "—"}</td>
            <td>{event.chatId ?? "—"}</td>
          </tr>
        ))}
      </Tables>
    </section>
  );
}
