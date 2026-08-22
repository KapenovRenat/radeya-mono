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
