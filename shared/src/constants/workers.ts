/**
 * Воркеры — фоновые задачи. Решения и устройство — docs/workers.md.
 */

export const WORKER_KEYS = {
  /** Заказы Kaspi и отправка поставщикам в Telegram. */
  ORDERS: 'ORDERS',
} as const;

export type WorkerKey = (typeof WORKER_KEYS)[keyof typeof WORKER_KEYS];

export const WORKER_TITLES: Record<WorkerKey, string> = {
  ORDERS: 'Получение заказов и отправка в Telegram',
};

/** Интервал между циклами, минуты. */
export const WORKER_INTERVAL_MINUTES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const WORKER_DEFAULT_INTERVAL_MINUTES = 2;

/** За сколько месяцев назад забирать заказы. */
export const WORKER_ORDER_PERIOD_MONTHS = [1, 2, 3] as const;
export const WORKER_DEFAULT_ORDER_PERIOD_MONTHS = 1;

/** Сколько ждать после оформления заказа перед отправкой поставщику, минуты. */
export const SUPPLIER_NOTIFY_DELAY_MINUTES = [10, 30, 60] as const;
export const SUPPLIER_NOTIFY_DEFAULT_DELAY_MINUTES = 60;

/** Дни недели по ISO: 1 — понедельник, 7 — воскресенье. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: 'Пн', 2: 'Вт', 3: 'Ср', 4: 'Чт', 5: 'Пт', 6: 'Сб', 7: 'Вс',
};

/** По умолчанию — как в старой админке: понедельник–суббота. */
export const SUPPLIER_NOTIFY_DEFAULT_WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6];

/** Окно отправки поставщикам по Астане: с 8:00 до 17:00. */
export const SUPPLIER_NOTIFY_FROM_HOUR = 8;
export const SUPPLIER_NOTIFY_TO_HOUR = 17;

/**
 * Склад Астаны. Заказы в наличии с него уходят в группу «Из наличия в Астане»
 * (её Telegram ID — `Warehouse.telegramChatId`), всё остальное — поставщику товара.
 */
export const ASTANA_STOCK_WAREHOUSE_CODE = 'PP3';

/**
 * Вид отправки в Telegram. Значения обязаны совпадать с enum DispatchKind в schema.prisma.
 */
export const DISPATCH_KINDS = {
  NEW: 'NEW',
  CANCEL: 'CANCEL',
  RETURN: 'RETURN',
} as const;

export type DispatchKind = (typeof DISPATCH_KINDS)[keyof typeof DISPATCH_KINDS];

/** Telegram ID: личка — положительное число, группа — отрицательное (`-100…`). */
export const TELEGRAM_CHAT_ID_PATTERN = /^-?\d{1,20}$/;

/**
 * Состояние воркера. Значения обязаны совпадать с enum WorkerStatus в schema.prisma.
 */
export const WORKER_STATUSES = {
  /** Выключен в настройках. */
  STOPPED: 'STOPPED',
  /** Ждёт следующего цикла. */
  IDLE: 'IDLE',
  /** Идёт цикл. */
  RUNNING: 'RUNNING',
  /** Последний цикл с ошибкой; следующий всё равно будет. */
  ERROR: 'ERROR',
} as const;

export type WorkerStatus = (typeof WORKER_STATUSES)[keyof typeof WORKER_STATUSES];

export const WORKER_STATUS_LABELS: Record<WorkerStatus, string> = {
  STOPPED: 'Остановлен',
  IDLE: 'Работает, ждёт цикла',
  RUNNING: 'Работает, идёт цикл',
  ERROR: 'Ошибка в последнем цикле',
};

/**
 * Виды событий журнала. В базе тип — строка, а не enum: новый вид события
 * не должен требовать миграции. Список закрыт здесь — опечатка в строке
 * иначе молча создала бы вид, который фильтр не найдёт.
 */
export const WORKER_EVENT_TYPES = {
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
  ORDER_ENTRIES_LOADED: 'ORDER_ENTRIES_LOADED',
  ORDER_ENTRIES_FAILED: 'ORDER_ENTRIES_FAILED',
  ORDER_ARRIVAL_DATE_CHANGED: 'ORDER_ARRIVAL_DATE_CHANGED',
  ORDER_CABINET_FAILED: 'ORDER_CABINET_FAILED',
  DISPATCH_SENT: 'DISPATCH_SENT',
  DISPATCH_CANCEL_SENT: 'DISPATCH_CANCEL_SENT',
  DISPATCH_RETURN_SENT: 'DISPATCH_RETURN_SENT',
  DISPATCH_SKIPPED: 'DISPATCH_SKIPPED',
  DISPATCH_NO_RECIPIENT: 'DISPATCH_NO_RECIPIENT',
  DISPATCH_WAITING_DATE: 'DISPATCH_WAITING_DATE',
  DISPATCH_RETRY: 'DISPATCH_RETRY',
  DISPATCH_FAILED: 'DISPATCH_FAILED',
  DISPATCH_BLOCKED: 'DISPATCH_BLOCKED',
  RUN_FAILED: 'RUN_FAILED',
  RUN_TIMEOUT: 'RUN_TIMEOUT',
  RUN_SKIPPED_LOCKED: 'RUN_SKIPPED_LOCKED',
  WORKER_STARTED: 'WORKER_STARTED',
  WORKER_STOPPED: 'WORKER_STOPPED',
  WORKER_PROCESS_STARTED: 'WORKER_PROCESS_STARTED',
  WORKER_RESTARTED: 'WORKER_RESTARTED',
  WORKER_FAILING: 'WORKER_FAILING',
  WORKER_RECOVERED: 'WORKER_RECOVERED',
  WORKER_DOWN: 'WORKER_DOWN',
  WORKER_UP: 'WORKER_UP',
  SETTINGS_CHANGED: 'SETTINGS_CHANGED',
} as const;

export type WorkerEventType = (typeof WORKER_EVENT_TYPES)[keyof typeof WORKER_EVENT_TYPES];

export const WORKER_EVENT_TYPE_LABELS: Record<WorkerEventType, string> = {
  ORDER_CREATED: 'Новый заказ',
  ORDER_STATUS_CHANGED: 'Смена статуса',
  ORDER_ENTRIES_LOADED: 'Состав загружен',
  ORDER_ENTRIES_FAILED: 'Состав не загрузился',
  ORDER_ARRIVAL_DATE_CHANGED: 'Дата прибытия',
  ORDER_CABINET_FAILED: 'Кабинет Kaspi не ответил',
  DISPATCH_SENT: 'Отправлено в Telegram',
  DISPATCH_CANCEL_SENT: 'Отправлена отмена',
  DISPATCH_RETURN_SENT: 'Отправлен возврат',
  DISPATCH_SKIPPED: 'Не отправлено',
  DISPATCH_NO_RECIPIENT: 'Некому отправить',
  DISPATCH_WAITING_DATE: 'Ждёт дату сдачи',
  DISPATCH_RETRY: 'Отправка не удалась, повтор',
  DISPATCH_FAILED: 'Отправка не удалась окончательно',
  DISPATCH_BLOCKED: 'Отправка невозможна',
  RUN_FAILED: 'Ошибка цикла',
  RUN_TIMEOUT: 'Цикл превысил время',
  RUN_SKIPPED_LOCKED: 'Цикл пропущен: идёт ручная синхронизация',
  WORKER_STARTED: 'Воркер запущен',
  WORKER_STOPPED: 'Воркер остановлен',
  WORKER_PROCESS_STARTED: 'Процесс воркера стартовал',
  WORKER_RESTARTED: 'Перезапуск после сбоя',
  WORKER_FAILING: 'Несколько циклов подряд с ошибкой',
  WORKER_RECOVERED: 'Воркер восстановился',
  WORKER_DOWN: 'Воркер не отвечает',
  WORKER_UP: 'Воркер снова на связи',
  SETTINGS_CHANGED: 'Изменены настройки',
};
