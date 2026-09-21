/**
 * Календарная арифметика для выбора периода.
 *
 * Отдельно от разметки: это чистые функции над датами, их легко проверить
 * глазами и переиспользовать, а компонент занят только отрисовкой.
 *
 * Везде **местное** время, а не UTC. День — это календарная клетка в поясе
 * пользователя: 1 сентября в Алматы и в UTC начинаются в разные моменты,
 * и календарь обязан показывать первое.
 */

/** Дата без времени: `YYYY-MM-DD`. Тот же формат, что у `input type="date"`. */
export type IsoDate = string;

/** Понедельник первым: так принято здесь, и так же в кабинете Kaspi. */
export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Шесть недель — постоянная высота сетки: иначе панель прыгает при смене месяца. */
const WEEKS_IN_GRID = 6;

export function toIso(date: Date): IsoDate {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Разбор `YYYY-MM-DD` в местную полночь.
 *
 * Через конструктор с числами, а не `new Date(строка)`: строку в этом формате
 * браузер разбирает как UTC, и в поясе UTC+5 дата уезжает на день назад.
 */
export function fromIso(value: IsoDate | null): Date | null {
  if (!value) return null;

  const [year, month, day] = value.split('-').map(Number);

  if (year === undefined || month === undefined || day === undefined) return null;

  const date = new Date(year, month - 1, day);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Сдвиг на месяцы.
 *
 * Конструктор сам переносит переполнение: 31 января + 1 месяц даёт 3 марта.
 * Поэтому сдвигаем от первого числа — для навигации по календарю этого хватает.
 */
export function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/** Строго между границами: сами границы рисуются иначе. */
export function isBetween(day: Date, from: Date | null, to: Date | null): boolean {
  if (from === null || to === null) return false;

  const time = day.getTime();

  return time > from.getTime() && time < to.getTime();
}

/**
 * Сетка месяца: шесть недель по семь дней.
 *
 * С хвостами соседних месяцев — их видно серым и по ним можно выбирать:
 * иначе, чтобы взять 31 августа, пришлось бы сначала листать назад.
 */
export function buildMonthGrid(view: Date): Date[][] {
  const first = startOfMonth(view);
  // getDay() считает от воскресенья, нам нужно от понедельника.
  const offset = (first.getDay() + 6) % 7;
  const weeks: Date[][] = [];

  for (let week = 0; week < WEEKS_IN_GRID; week += 1) {
    const days: Date[] = [];

    for (let day = 0; day < 7; day += 1) {
      days.push(new Date(
        first.getFullYear(),
        first.getMonth(),
        1 - offset + week * 7 + day,
      ));
    }

    weeks.push(days);
  }

  return weeks;
}

const monthFormatter = new Intl.DateTimeFormat('ru-RU', { month: 'long' });
const dayFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit', month: '2-digit', year: 'numeric',
});
const fullDayFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric',
});

/** `Сентябрь 2026` — с заглавной: Intl отдаёт месяц строчными. */
export function formatMonth(date: Date): string {
  const month = monthFormatter.format(date);

  return month.charAt(0).toUpperCase() + month.slice(1) + ' ' + date.getFullYear();
}

/** `21.09.2026` — для кнопки и подписей. */
export function formatDay(date: Date): string {
  return dayFormatter.format(date);
}

/** `21 сентября 2026` — для подписи дня скринридеру: «21.09» он прочтёт цифрами. */
export function formatFullDay(date: Date): string {
  return fullDayFormatter.format(date);
}

/** Границы в том порядке, в каком их выбрали: клик «назад» не должен ломать период. */
export function orderRange(a: Date, b: Date): { from: Date; to: Date } {
  return a.getTime() <= b.getTime() ? { from: a, to: b } : { from: b, to: a };
}
