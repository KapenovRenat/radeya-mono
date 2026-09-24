/**
 * Границы суток в часовом поясе пользователя.
 *
 * Календари отдают `YYYY-MM-DD` — это сутки **там, где сидит человек**,
 * и переводить их в момент должен клиент: сервер не знает его пояса,
 * а «за 21 сентября» в Алматы и в UTC — разные наборы заказов.
 *
 * Общее место, а не копия в каждом фильтре: реестр заказов и сводка обязаны
 * понимать «сентябрь» одинаково, иначе цифры на двух страницах разойдутся,
 * и никто не поймёт почему.
 */

/** Начало суток, ISO. */
export function dayStart(year: number, month: number, day: number): string {
  return new Date(year, month, day, 0, 0, 0, 0).toISOString();
}

/** Конец суток, ISO. Последняя миллисекунда — границы периода включительные. */
export function dayEnd(year: number, month: number, day: number): string {
  return new Date(year, month, day, 23, 59, 59, 999).toISOString();
}

/** Собранная из чисел дата бывает несуществующей: `toISOString()` на ней бросает. */
function isRealDate(year: number, month: number, day: number): boolean {
  return !Number.isNaN(new Date(year, month, day).getTime());
}

/**
 * Дата из календаря в момент времени.
 *
 * `edge` выбирает край суток: начало для левой границы периода, конец для
 * правой, чтобы обе даты попадали внутрь.
 */
export function toMoment(date: string | null, edge: "start" | "end"): string | undefined {
  if (date === null) return undefined;

  const [year, month, day] = date.split("-").map(Number);

  if (year === undefined || month === undefined || day === undefined) return undefined;
  if (!isRealDate(year, month - 1, day)) return undefined;

  return edge === "start"
    ? dayStart(year, month - 1, day)
    : dayEnd(year, month - 1, day);
}

export interface Period {
  from: string;
  to: string;
}

/** Текущий месяц: с первого числа по конец сегодняшнего дня. */
export function currentMonth(now = new Date()): Period {
  return {
    from: dayStart(now.getFullYear(), now.getMonth(), 1),
    to: dayEnd(now.getFullYear(), now.getMonth(), now.getDate()),
  };
}

/**
 * Прошлый месяц целиком.
 *
 * Последний день считается нулевым днём следующего месяца — так не нужен
 * ни список длин месяцев, ни отдельная проверка високосного года.
 */
export function previousMonth(now = new Date()): Period {
  const year = now.getFullYear();
  const month = now.getMonth() - 1;
  const lastDay = new Date(year, month + 1, 0).getDate();

  return {
    from: dayStart(year, month, 1),
    to: dayEnd(year, month, lastDay),
  };
}
