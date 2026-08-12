/**
 * Источники заказов. По ним фильтруется реестр заказов
 * и переключается статистика на Dashboard.
 */
export const ORDER_SOURCES = {
  SITE: 'SITE',
  KASPI: 'KASPI',
  OFFLINE: 'OFFLINE',
} as const;

export type OrderSource = (typeof ORDER_SOURCES)[keyof typeof ORDER_SOURCES];

/** Подписи для интерфейса. Держим рядом с самими значениями, чтобы не разъезжались. */
export const ORDER_SOURCE_LABELS: Record<OrderSource, string> = {
  SITE: 'Сайт-магазин',
  KASPI: 'Kaspi',
  OFFLINE: 'Офлайн-магазин',
};
