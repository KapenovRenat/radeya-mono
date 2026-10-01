import type { Weekday, WorkerEventType, WorkerKey, WorkerStatus } from '../constants/workers';

/** Настройки воркера — то, что меняется в блоке «Воркеры» и применяется после «Сохранить». */
export interface WorkerSettingsDto {
  enabled: boolean;
  intervalMinutes: number;
  periodMonths: number;
  /** Отправлять поставщикам в Telegram. */
  supplierNotifyEnabled: boolean;
  /** Тестовый режим: задержка не действует, заказ уходит в ближайшем цикле. */
  supplierNotifyInstant: boolean;
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

/** Строка журнала воркера: что произошло и, у отправок, кому. */
export interface WorkerEventDto {
  id: string;
  at: string;
  type: WorkerEventType;
  orderCode: string | null;
  /** Когда заказ оформлен в Kaspi. */
  orderPlacedAt: string | null;
  message: string;
  /** Получатель отправки: поставщик, группа склада, разработчик — или кому собирались. */
  recipientName: string | null;
  /** Telegram ID получателя; пусто — его и не было («некому отправить»). */
  chatId: string | null;
}

export interface WorkerEventsQuery {
  page: number;
  pageSize: number;
  type?: WorkerEventType;
  orderCode?: string;
}

export interface WorkerEventsResponse {
  items: WorkerEventDto[];
  total: number;
  page: number;
  pageSize: number;
}

/** Вид тестовой карточки — те же, что уходят по настоящим заказам. */
export type TestCardKind = 'NEW' | 'CANCEL_BY_CUSTOMER' | 'CANCEL_IN_TRANSIT' | 'RETURN';

/**
 * Тестовая карточка: выдуманный заказ с диваном из каталога.
 * `ONE` — на `chatId`; `ALL` — всем, у кого есть Telegram ID: группе Астаны,
 * активным поставщикам и на `chatId`, если он указан.
 */
export interface SendTestCardRequest {
  target: 'ONE' | 'ALL';
  chatId: string | null;
  kind: TestCardKind;
}

/** Итог по одному получателю тестовой карточки. */
export interface TestCardResult {
  recipient: string;
  chatId: string;
  ok: boolean;
  /** Ответ Telegram при отказе: «chat not found» и т.п. */
  error: string | null;
}

export interface SendTestCardResponse {
  /** Какой товар каталога взят для карточки. */
  sku: string;
  productName: string;
  /** Нашли фото товара или карточка ушла с заглушкой. */
  hasImage: boolean;
  results: TestCardResult[];
}
