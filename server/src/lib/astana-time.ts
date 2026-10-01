/**
 * Время по Астане — вся система живёт по нему (решение пользователя, STATUS.md).
 * Через Intl, а не сдвигом на +5 часов: так не нужно помнить, что пояс
 * Казахстана уже менялся.
 */

const TIME_ZONE = 'Asia/Almaty';

const dayFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: TIME_ZONE, day: 'numeric', month: 'long',
});

const dayWithYearFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric',
});

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE, weekday: 'short', hour: '2-digit', hourCycle: 'h23',
});

const ISO_WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** «27 сентября» — как на карточке поставщику. */
export function formatAstanaDay(date: Date): string {
  return dayFormatter.format(date);
}

/** «1 окт. 2026 г.» — для журнала, где год нужен. Пусто — прочерк. */
export function formatAstanaDayWithYear(date: Date | null): string {
  return date === null ? '—' : dayWithYearFormatter.format(date);
}

/** День недели по ISO (1 — понедельник) и час по Астане. */
export function astanaWeekdayAndHour(date: Date): { weekday: number; hour: number } {
  const parts = partsFormatter.formatToParts(date);
  const weekday = ISO_WEEKDAY[parts.find((part) => part.type === 'weekday')?.value ?? ''] ?? 0;
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 'NaN');

  return { weekday, hour };
}
