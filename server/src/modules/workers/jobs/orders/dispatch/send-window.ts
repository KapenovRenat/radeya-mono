import { SUPPLIER_NOTIFY_FROM_HOUR, SUPPLIER_NOTIFY_TO_HOUR } from '@radeya/shared';

import { astanaWeekdayAndHour } from '../../../../../lib/astana-time';

/**
 * Можно ли слать сейчас: отмеченный день недели и с 8:00 до 17:00 по Астане.
 *
 * Отдельного «перенести на понедельник» нет: вне окна шаг просто не шлёт,
 * а заказы остаются кандидатами и уходят в первом цикле внутри окна —
 * ночные утром, субботние при выключенном воскресенье — в понедельник.
 */
export function isWithinSendWindow(now: Date, weekdays: readonly number[]): boolean {
  const { weekday, hour } = astanaWeekdayAndHour(now);

  return weekdays.includes(weekday) && hour >= SUPPLIER_NOTIFY_FROM_HOUR && hour < SUPPLIER_NOTIFY_TO_HOUR;
}
