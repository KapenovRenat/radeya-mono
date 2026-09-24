/**
 * Точки продаж.
 *
 * Единый справочник для всех источников заказа: и площадки (Kaspi, Ozon, сайт),
 * и офлайн-магазины лежат в одной таблице `SalesPoint`. Благодаря этому фильтр
 * в реестре заказов и разрез статистики — один список, а не склейка перечисления
 * с таблицей.
 *
 * Отличие от `SALES_CHANNELS`: там канал **размещения товара** (`Listing.channel`),
 * здесь — откуда пришёл **заказ**. Значения похожи, смысл разный, и сводить их
 * в одно перечисление нельзя: офлайн-точка не место размещения карточки.
 */

export const SALES_POINT_TYPES = {
  KASPI: 'KASPI',
  OZON: 'OZON',
  SITE: 'SITE',
  OFFLINE: 'OFFLINE',
} as const;

export type SalesPointType = (typeof SALES_POINT_TYPES)[keyof typeof SALES_POINT_TYPES];

export const SALES_POINT_TYPE_LABELS: Record<SalesPointType, string> = {
  KASPI: 'Kaspi',
  OZON: 'Ozon',
  SITE: 'Сайт-магазин',
  OFFLINE: 'Офлайн-точка',
};

/**
 * Коды системных точек.
 *
 * Синхронизация ищет точку Kaspi по коду, а не по идентификатору: uuid на каждой
 * базе свой, а код одинаковый везде. Поэтому системные точки переименовываются,
 * но их коды неизменны, и через API они не создаются — только сидом миграции.
 */
export const SYSTEM_SALES_POINT_CODES = {
  KASPI: 'KASPI',
  OZON: 'OZON',
  SITE: 'SITE',
} as const;

/** Системная точка — любая, кроме офлайновой: её строку заводим мы, а не пользователь. */
export function isSystemSalesPointType(type: SalesPointType): boolean {
  return type !== SALES_POINT_TYPES.OFFLINE;
}

/**
 * Префикс кода офлайн-точки: `OFF-1`, `OFF-2`. Генерит сервер.
 *
 * Код не выводится из названия намеренно: транслит даёт спорные правила
 * и неожиданные совпадения («Абая» и «Абай»), а читаемость и так даёт `name`.
 * Тот же приём, что у служебного `slug` категорий.
 */
export const OFFLINE_SALES_POINT_CODE_PREFIX = 'OFF';

export const SALES_POINT_NAME_MAX_LENGTH = 80;

/**
 * Префикс номера офлайн-заказа: `OFF-1-000123`.
 *
 * Номер заказа уникален по всей таблице, а у Kaspi он состоит только из цифр.
 * Буква в начале гарантирует, что офлайн-номер никогда не совпадёт с номером
 * площадки: при совпадении синхронизация сделала бы `upsert` в офлайн-заказ
 * и затёрла его, а восстановить такую запись нечем.
 */
export const OFFLINE_ORDER_CODE_SEPARATOR = '-';

export const ORDER_COMMENT_MAX_LENGTH = 2000;
