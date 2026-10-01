import { ORDER_STATUSES, type OrderStatus } from '@radeya/shared';

/**
 * Отправка заказов в Telegram — решения в docs/workers.md, раздел 1.
 */

/** Сколько сообщений за цикл: остальное — в следующих циклах. Лимиты Telegram не любят очередей. */
export const MAX_SENDS_PER_RUN = 10;

/** Пауза между сообщениями — как в старой админке. */
export const SEND_PAUSE_MS = 1500;

/** Сколько заказов-кандидатов смотреть за цикл. */
export const MAX_ORDERS_PER_RUN = 30;

/** Попыток на одно сообщение; дальше — «не удалось» и оповещение разработчику. */
export const MAX_SEND_ATTEMPTS = 5;

/** Дата сдачи свежее этого — не перечитываем из кабинета перед отправкой. */
export const ARRIVAL_DATE_FRESH_MS = 15 * 60_000;

/** Логист Kaspi Доставки: «Отгрузка на Zammler в г. …» — как в старой админке. */
export const KASPI_LOGISTICS_NAME = 'Zammler';

/** Название группы склада Астаны в журнале и подписях. */
export const ASTANA_GROUP_NAME = 'Из наличия в Астане';

/**
 * Заказ закрылся до отправки — новый заказ не шлём. Отмена «в пути» тоже здесь:
 * поставщик о заказе не знал, отменять ему нечего.
 */
export const CLOSED_BEFORE_SEND: readonly OrderStatus[] = [
  ORDER_STATUSES.CANCELLING,
  ORDER_STATUSES.CANCELLED,
  ORDER_STATUSES.RETURN_REQUESTED,
  ORDER_STATUSES.RETURNED,
  ORDER_STATUSES.DELIVERED,
];

/** Стадии, после которых отправленному заказу вдогонку уходит отмена. */
export const CANCEL_STATUSES: readonly OrderStatus[] = [
  ORDER_STATUSES.CANCELLING,
  ORDER_STATUSES.CANCELLED,
];
