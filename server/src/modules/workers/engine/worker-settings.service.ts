import {
  WEEKDAYS,
  WEEKDAY_LABELS,
  WORKER_EVENT_TYPES,
  WORKER_TITLES,
  type UpdateWorkerSettingsRequest,
  type Weekday,
  type WorkerDto,
  type WorkerKey,
  type WorkerSettingsDto,
  type WorkerStatus,
} from '@radeya/shared';

import { prisma } from '../../../db/client';
import type { WorkerSettings, WorkerState } from '../../../generated/prisma/client';
import { isTelegramConfigured } from '../../../lib/telegram';
import { recordWorkerEvent } from './worker-events.service';
import { HEARTBEAT_STALE_MS } from './worker.constants';

/**
 * Настройки и состояние воркеров. Строки заводятся сами при первом чтении —
 * значениями по умолчанию из схемы: заводить их миграцией незачем.
 */

export async function loadWorkerSettings(key: WorkerKey): Promise<WorkerSettings> {
  return prisma.workerSettings.upsert({ where: { key }, create: { key }, update: {} });
}

export async function loadWorkerState(key: WorkerKey): Promise<WorkerState> {
  return prisma.workerState.upsert({ where: { key }, create: { key }, update: {} });
}

/** Поля состояния, которые меняют воркер и наблюдатель. */
export interface WorkerStatePatch {
  status?: WorkerStatus;
  heartbeatAt?: Date | null;
  runStartedAt?: Date | null;
  lastRunFinishedAt?: Date | null;
  lastRunTookMs?: number | null;
  lastSuccessAt?: Date | null;
  lastError?: string | null;
  consecutiveFailures?: number;
  nextRunAt?: Date | null;
  lastRunStats?: Record<string, number>;
  downNotified?: boolean;
}

export async function updateWorkerState(key: WorkerKey, patch: WorkerStatePatch): Promise<void> {
  await prisma.workerState.upsert({ where: { key }, create: { key, ...patch }, update: patch });
}

export function isHeartbeatFresh(heartbeatAt: Date | null, now = Date.now()): boolean {
  return heartbeatAt !== null && now - heartbeatAt.getTime() < HEARTBEAT_STALE_MS;
}

export async function listWorkers(): Promise<WorkerDto[]> {
  const keys = Object.keys(WORKER_TITLES) as WorkerKey[];

  return Promise.all(keys.map(async (key) => toWorkerDto(
    key, await loadWorkerSettings(key), await loadWorkerState(key),
  )));
}

/**
 * Сохранение настроек из блока «Воркеры». Воркер подхватит их сам — он
 * перечитывает настройки перед циклом и во время ожидания.
 *
 * Включили отправку поставщикам — ставится точка отсечки «сейчас»: уходить
 * будут только заказы, оформленные после неё, а не весь период разом.
 */
export async function updateWorkerSettings(
  key: WorkerKey,
  input: UpdateWorkerSettingsRequest,
  authorLogin: string,
): Promise<{ before: WorkerSettingsDto; after: WorkerSettingsDto; worker: WorkerDto }> {
  const before = await loadWorkerSettings(key);
  const weekdays = [...new Set(input.supplierNotifyWeekdays)].sort((a, b) => a - b);
  const turnedOnNotify = !before.supplierNotifyEnabled && input.supplierNotifyEnabled;

  const after = await prisma.workerSettings.update({
    where: { key },
    data: {
      enabled: input.enabled,
      intervalMinutes: input.intervalMinutes,
      periodMonths: input.periodMonths,
      supplierNotifyEnabled: input.supplierNotifyEnabled,
      supplierNotifyDelayMinutes: input.supplierNotifyDelayMinutes,
      supplierNotifyWeekdays: weekdays,
      ...(turnedOnNotify ? { supplierNotifyFrom: new Date() } : {}),
      devAlertsEnabled: input.devAlertsEnabled,
      devChatId: input.devChatId,
    },
  });

  const changes = describeChanges(before, after);

  if (changes.length > 0) {
    await recordWorkerEvent(key, {
      type: WORKER_EVENT_TYPES.SETTINGS_CHANGED,
      message: `${authorLogin}: ${changes.join('; ')}`,
      details: { author: authorLogin, changes },
    });
  }

  return {
    before: toSettingsDto(before),
    after: toSettingsDto(after),
    worker: toWorkerDto(key, after, await loadWorkerState(key)),
  };
}

function toWorkerDto(key: WorkerKey, settings: WorkerSettings, state: WorkerState): WorkerDto {
  const iso = (value: Date | null) => value?.toISOString() ?? null;

  return {
    key,
    title: WORKER_TITLES[key],
    settings: toSettingsDto(settings),
    state: {
      status: state.status,
      alive: isHeartbeatFresh(state.heartbeatAt),
      heartbeatAt: iso(state.heartbeatAt),
      runStartedAt: iso(state.runStartedAt),
      lastRunFinishedAt: iso(state.lastRunFinishedAt),
      lastRunTookMs: state.lastRunTookMs,
      lastSuccessAt: iso(state.lastSuccessAt),
      lastError: state.lastError,
      consecutiveFailures: state.consecutiveFailures,
      nextRunAt: iso(state.nextRunAt),
      lastRunStats: readStats(state.lastRunStats),
    },
    telegramConfigured: isTelegramConfigured(),
  };
}

function toSettingsDto(settings: WorkerSettings): WorkerSettingsDto {
  return {
    enabled: settings.enabled,
    intervalMinutes: settings.intervalMinutes,
    periodMonths: settings.periodMonths,
    supplierNotifyEnabled: settings.supplierNotifyEnabled,
    supplierNotifyDelayMinutes: settings.supplierNotifyDelayMinutes,
    supplierNotifyWeekdays: settings.supplierNotifyWeekdays.filter(isWeekday),
    devAlertsEnabled: settings.devAlertsEnabled,
    devChatId: settings.devChatId,
    updatedAt: settings.updatedAt.toISOString(),
  };
}

export function isWeekday(value: number): value is Weekday {
  return (WEEKDAYS as readonly number[]).includes(value);
}

/** Счётчики цикла из Json — только числовые поля, остальное отбрасываем. */
function readStats(value: unknown): Record<string, number> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
  );
}

/** «интервал 2 → 3 мин» — для журнала, человеческим языком. */
function describeChanges(before: WorkerSettings, after: WorkerSettings): string[] {
  const onOff = (value: boolean) => (value ? 'вкл' : 'выкл');
  const days = (list: number[]) => list.filter(isWeekday).map((day) => WEEKDAY_LABELS[day]).join(', ') || 'нет';
  const changes: string[] = [];

  const compare = (label: string, from: string, to: string) => {
    if (from !== to) changes.push(`${label}: ${from} → ${to}`);
  };

  compare('работает', onOff(before.enabled), onOff(after.enabled));
  compare('интервал', `${before.intervalMinutes} мин`, `${after.intervalMinutes} мин`);
  compare('период', `${before.periodMonths} мес`, `${after.periodMonths} мес`);
  compare('отправка поставщикам', onOff(before.supplierNotifyEnabled), onOff(after.supplierNotifyEnabled));
  compare('задержка', `${before.supplierNotifyDelayMinutes} мин`, `${after.supplierNotifyDelayMinutes} мин`);
  compare('дни отправки', days(before.supplierNotifyWeekdays), days(after.supplierNotifyWeekdays));
  compare('оповещения разработчику', onOff(before.devAlertsEnabled), onOff(after.devAlertsEnabled));
  compare('Telegram ID разработчика', before.devChatId ?? 'нет', after.devChatId ?? 'нет');

  return changes;
}
