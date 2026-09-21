/**
 * Синхронизация заказов из Kaspi Shop API.
 *
 * Подробности источника — docs/kaspi-api-integration.md, разделы 2–3.
 */

/** Периоды кнопок синхронизации. */
export const KASPI_ORDER_PERIODS = {
  LAST_3_MONTHS: '3m',
  LAST_2_YEARS: '2y',
} as const;

export type KaspiOrderPeriod =
  (typeof KASPI_ORDER_PERIODS)[keyof typeof KASPI_ORDER_PERIODS];

export const KASPI_ORDER_PERIOD_LABELS: Record<KaspiOrderPeriod, string> = {
  '3m': 'За последние 3 месяца',
  '2y': 'За последние 2 года',
};

/** Сколько дней назад начинается период. */
export const KASPI_ORDER_PERIOD_DAYS: Record<KaspiOrderPeriod, number> = {
  '3m': 92,
  '2y': 730,
};

/**
 * Ширина одного отрезка в днях.
 *
 * Kaspi отдаёт около 10 000 позиций на диапазон независимо от пагинации,
 * поэтому год одним запросом теряет хвост. Три дня — из наработок прошлого
 * проекта, проверено на боевых объёмах.
 */
export const KASPI_ORDER_CHUNK_DAYS = 3;

/** Размер страницы Kaspi. Больше сотни он не отдаёт. */
export const KASPI_ORDER_PAGE_SIZE = 100;

/**
 * Сколько отрезков обрабатывается за один вызов.
 *
 * Два года — это 244 отрезка: в одном запросе это минуты, за которые оборвётся
 * либо браузер, либо прокси. Поэтому синхронизация возобновляемая: вызов берёт
 * пачку и возвращает курсор, клиент повторяет, пока не `done`.
 */
export const KASPI_SYNC_DEFAULT_CHUNKS = 20;
export const KASPI_SYNC_MAX_CHUNKS = 100;
