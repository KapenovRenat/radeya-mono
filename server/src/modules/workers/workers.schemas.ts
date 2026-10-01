import { z } from 'zod';
import {
  SUPPLIER_NOTIFY_DELAY_MINUTES,
  TELEGRAM_CHAT_ID_PATTERN,
  WEEKDAYS,
  WORKER_INTERVAL_MINUTES,
  WORKER_KEYS,
  WORKER_ORDER_PERIOD_MONTHS,
  type Weekday,
} from '@radeya/shared';

/** Значение только из закрытого списка: выпадашка не даёт другого, и сервер тоже. */
const oneOf = (allowed: readonly number[], message: string) =>
  z.number().int().refine((value) => allowed.includes(value), message);

export const workerParamsSchema = z.object({ key: z.enum(WORKER_KEYS) });

export const updateWorkerSettingsSchema = z.object({
  enabled: z.boolean(),
  intervalMinutes: oneOf(WORKER_INTERVAL_MINUTES, 'Интервал — от 1 до 10 минут'),
  periodMonths: oneOf(WORKER_ORDER_PERIOD_MONTHS, 'Период — 1, 2 или 3 месяца'),
  supplierNotifyEnabled: z.boolean(),
  supplierNotifyDelayMinutes: oneOf(SUPPLIER_NOTIFY_DELAY_MINUTES, 'Задержка — 10, 30 или 60 минут'),
  // Каждый день проверен oneOf выше — сужение типа здесь только закрепляет проверенное.
  supplierNotifyWeekdays: z.array(oneOf(WEEKDAYS, 'День недели — от 1 до 7')).max(WEEKDAYS.length)
    .transform((days) => days as Weekday[]),
  devAlertsEnabled: z.boolean(),
  devChatId: z.string().trim().regex(TELEGRAM_CHAT_ID_PATTERN, 'Telegram ID — только цифры, у группы с минусом')
    .nullable(),
}).strict()
  // Включённые оповещения без адреса молча никуда не уходили бы.
  .refine((body) => !body.devAlertsEnabled || body.devChatId !== null, {
    message: 'Для оповещений разработчику укажите Telegram ID',
    path: ['devChatId'],
  })
  .refine((body) => !body.supplierNotifyEnabled || body.supplierNotifyWeekdays.length > 0, {
    message: 'Для отправки поставщикам выберите хотя бы один день',
    path: ['supplierNotifyWeekdays'],
  });
