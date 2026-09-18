/**
 * Форматирование даты и времени для интерфейса.
 *
 * Через Intl, а не руками: он сам подставит ведущие нули и учтёт часовой пояс
 * пользователя. Сервер отдаёт время в UTC, показывать его как есть нельзя —
 * человек увидит не тот час, в который что-то произошло.
 */
const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** `22.08.2026, 14:35` */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return "—";

  return dateTimeFormatter.format(date);
}

/**
 * Цена из API в число для показа.
 *
 * Сервер отдаёт деньги строкой `"48230.00"` — намеренно: number на цене
 * теряет тиын и накапливает ошибку при сложении. Для вывода на экран число
 * годится, для арифметики над деньгами — нет: считать нужно целыми тиын.
 *
 * Пусто и «ноль» — разное: `null` означает, что цены нет вовсе, и в таблице
 * это прочерк, а не 0 ₸.
 */
export function moneyToNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Цена для показа: `114 990 ₸`.
 *
 * Тиын не показываем: цены Kaspi целые в тенге, а дробная часть в таблице
 * только мешает сравнивать столбец глазами.
 */
const moneyFormatter = new Intl.NumberFormat("ru-KZ", {
  style: "currency",
  currency: "KZT",
  maximumFractionDigits: 0,
});

export function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}
