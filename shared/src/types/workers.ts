import type { Weekday, WorkerKey, WorkerStatus } from '../constants/workers';

/** Настройки воркера — то, что меняется в блоке «Воркеры» и применяется после «Сохранить». */
export interface WorkerSettingsDto {
  enabled: boolean;
  intervalMinutes: number;
  periodMonths: number;
  /** Отправлять поставщикам в Telegram. */
  supplierNotifyEnabled: boolean;
  supplierNotifyDelayMinutes: number;
  supplierNotifyWeekdays: Weekday[];
  /** Оповещать разработчика о состоянии воркера. */
  devAlertsEnabled: boolean;
  devChatId: string | null;
  updatedAt: string;
}

export type UpdateWorkerSettingsRequest = Omit<WorkerSettingsDto, 'updatedAt'>;

export interface WorkerStateDto {
  status: WorkerStatus;
  /** Процесс воркера жив: пульс свежий. */
  alive: boolean;
  heartbeatAt: string | null;
  runStartedAt: string | null;
  lastRunFinishedAt: string | null;
  lastRunTookMs: number | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  nextRunAt: string | null;
  /** Счётчики последнего цикла: получено, новых, смен статуса, составов. */
  lastRunStats: Record<string, number> | null;
}

export interface WorkerDto {
  key: WorkerKey;
  title: string;
  settings: WorkerSettingsDto;
  state: WorkerStateDto;
  /** Задан ли токен бота на сервере — без него оповещения не уйдут. */
  telegramConfigured: boolean;
}

export interface WorkersResponse {
  items: WorkerDto[];
}
