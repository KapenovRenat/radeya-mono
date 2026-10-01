"use client";

import { useId } from "react";
import {
  SUPPLIER_NOTIFY_DELAY_MINUTES,
  SUPPLIER_NOTIFY_FROM_HOUR,
  SUPPLIER_NOTIFY_TO_HOUR,
  WEEKDAYS,
  WEEKDAY_LABELS,
  WORKER_INTERVAL_MINUTES,
  WORKER_ORDER_PERIOD_MONTHS,
  WORKER_STATUS_LABELS,
  type WorkerDto,
} from "@radeya/shared";

import { Button } from "@/components/button";
import { Checkbox } from "@/components/checkbox";
import { Dropdown, type DropdownOption } from "@/components/dropdown";
import { Input } from "@/components/input";
import { useGetWorkersQuery } from "@/features/workers/workers-api";
import { useWorkerSettingsForm } from "@/features/workers/use-worker-settings-form";
import { apiErrorMessage } from "@/shared/api/error-message";
import { formatDateTime } from "@/lib/format";

/** Опрос состояния: воркер пишет пульс раз в 15 секунд — чаще смотреть незачем. */
const STATE_POLL_MS = 15_000;

const INTERVAL_OPTIONS: DropdownOption[] = WORKER_INTERVAL_MINUTES.map((minutes) => ({
  value: String(minutes), label: `${minutes} мин`,
}));

const PERIOD_OPTIONS: DropdownOption[] = WORKER_ORDER_PERIOD_MONTHS.map((months) => ({
  value: String(months), label: `${months} мес`,
}));

const DELAY_OPTIONS: DropdownOption[] = SUPPLIER_NOTIFY_DELAY_MINUTES.map((minutes) => ({
  value: String(minutes), label: minutes === 60 ? "1 час" : `${minutes} минут`,
}));

/**
 * Блок «Воркеры»: карточка на каждый воркер с настройками и состоянием.
 * Разметка минимальная, на общих компонентах — вид дорабатывается отдельно.
 */
export function WorkersBlock() {
  const workers = useGetWorkersQuery(undefined, { pollingInterval: STATE_POLL_MS });

  return (
    <section className="space-y-4" aria-labelledby="workers-title">
      <h2 id="workers-title" className="text-lg font-semibold">Воркеры</h2>

      {workers.error && (
        <p role="alert" className="text-sm text-destructive">
          {apiErrorMessage(workers.error, "Не удалось загрузить воркеры")}
        </p>
      )}

      {workers.data?.items.map((worker) => <WorkerCard key={worker.key} worker={worker} />)}
    </section>
  );
}

function WorkerCard({ worker }: { worker: WorkerDto }) {
  const form = useWorkerSettingsForm(worker);
  const { value } = form;
  const id = useId();
  const { state } = worker;
  const stats = state.lastRunStats;

  return (
    <div className="max-w-2xl space-y-3 rounded-lg border p-4">
      <h3 className="font-medium">{worker.title}</h3>

      <dl className="text-sm">
        <div>
          <dt className="inline">Состояние: </dt>
          <dd className="inline">{WORKER_STATUS_LABELS[state.status]}</dd>
        </div>

        {worker.settings.enabled && !state.alive && (
          <p role="alert" className="text-destructive">
            Процесс воркера не отвечает — не запущен (`npm run worker`) или упал.
          </p>
        )}

        {state.lastRunFinishedAt && (
          <div>
            <dt className="inline">Последний цикл: </dt>
            <dd className="inline">
              {formatDateTime(state.lastRunFinishedAt)}
              {state.lastRunTookMs !== null && `, ${(state.lastRunTookMs / 1000).toFixed(1)} с`}
              {stats && ` · получено ${stats.ordersSeen ?? 0}, новых ${stats.created ?? 0}, `
                + `смен статуса ${stats.statusChanged ?? 0}, составов ${stats.entriesLoaded ?? 0}, `
                + `отправлено ${(stats.dispatchSent ?? 0) + (stats.dispatchCancelSent ?? 0) + (stats.dispatchReturnSent ?? 0)}`
                + (stats.outsideSendWindow ? " (вне часов отправки)" : "")}
            </dd>
          </div>
        )}

        {state.nextRunAt && (
          <div>
            <dt className="inline">Следующий цикл: </dt>
            <dd className="inline">{formatDateTime(state.nextRunAt)}</dd>
          </div>
        )}

        {state.lastError && (
          <div className="text-destructive">
            <dt className="inline">Ошибка ({state.consecutiveFailures} подряд): </dt>
            <dd className="inline">{state.lastError}</dd>
          </div>
        )}

        {!worker.telegramConfigured && (
          <p className="text-destructive">TELEGRAM_BOT_TOKEN не задан на сервере — оповещения не уйдут.</p>
        )}
      </dl>

      <Checkbox
        label="Работает"
        checked={value.enabled}
        onChange={(event) => form.set("enabled", event.target.checked)}
      />

      <div className="flex flex-wrap gap-4">
        <Dropdown
          mode="select"
          label="Интервал"
          options={INTERVAL_OPTIONS}
          value={String(value.intervalMinutes)}
          onChange={(next) => form.set("intervalMinutes", Number(next))}
        />

        <Dropdown
          mode="select"
          label="Период заказов"
          options={PERIOD_OPTIONS}
          value={String(value.periodMonths)}
          onChange={(next) => form.set("periodMonths", Number(next))}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Заказы в Telegram</legend>

        <Checkbox
          label="Отправлять заказы поставщикам и в группу Астаны"
          checked={value.supplierNotifyEnabled}
          onChange={(event) => form.set("supplierNotifyEnabled", event.target.checked)}
        />

        <p className="text-sm">
          Уходят только заказы, оформленные после включения галочки — старые не высыпаются.
          Kaspi Доставка без даты сдачи ждёт, пока кабинет её не отдаст.
          Кому слать — блок «Получатели в Telegram» ниже.
        </p>

        <Dropdown
          mode="select"
          label="Отправлять через"
          options={DELAY_OPTIONS}
          value={String(value.supplierNotifyDelayMinutes)}
          onChange={(next) => form.set("supplierNotifyDelayMinutes", Number(next))}
        />

        <div className="flex flex-wrap gap-3" role="group" aria-label="Дни отправки">
          {WEEKDAYS.map((day) => (
            <Checkbox
              key={day}
              label={WEEKDAY_LABELS[day]}
              checked={value.supplierNotifyWeekdays.includes(day)}
              onChange={() => form.toggleWeekday(day)}
            />
          ))}
        </div>

        <p className="text-sm">
          С {SUPPLIER_NOTIFY_FROM_HOUR}:00 до {SUPPLIER_NOTIFY_TO_HOUR}:00 по Астане.
          Ночные заказы уходят утром ближайшего отмеченного дня.
        </p>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Оповещения разработчику</legend>

        <Checkbox
          label="Сообщать о состоянии воркера: упал, восстановился, перезапущен"
          checked={value.devAlertsEnabled}
          onChange={(event) => form.set("devAlertsEnabled", event.target.checked)}
        />

        <Input
          id={id + "-dev-chat"}
          label="Telegram ID разработчика"
          value={value.devChatId}
          onChange={(event) => form.set("devChatId", event.target.value)}
          placeholder="Например, 123456789"
          inputMode="numeric"
          autoComplete="off"
        />
      </fieldset>

      <div className="flex gap-2">
        <Button type="button" disabled={!form.isDirty || form.isSaving} onClick={() => { void form.save(); }}>
          {form.isSaving ? "Сохраняю…" : "Сохранить"}
        </Button>

        <Button type="button" disabled={!form.isDirty || form.isSaving} onClick={form.reset}>
          Отменить
        </Button>
      </div>

      {form.error && <p role="alert" className="text-sm text-destructive">{form.error}</p>}
      {form.notice && <p role="status" className="text-sm">{form.notice}</p>}
    </div>
  );
}
