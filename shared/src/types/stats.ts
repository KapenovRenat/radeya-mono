import type { SalesPointType } from '../constants/sales-points';

/**
 * Сводка по заказам за период.
 *
 * Разрез — точка продаж: Kaspi, Ozon и каждая офлайн-точка по отдельности,
 * плюс строка «Всего». Так устроен и сам реестр, и незачем заводить второй
 * способ смотреть на те же данные.
 *
 * **Привязанные заказы в суммы не входят.** Офлайн-продажа, уехавшая
 * Kaspi-доставкой, лежит в двух записях, и сложить их значило бы удвоить
 * выручку. Считается заказ площадки, а офлайновый показывается справочно
 * в `linkedCount` и `linkedAmount`.
 */
export interface OrderStatsCard {
  /** null у строки «Всего». */
  salesPoint: { id: string; name: string; type: SalesPointType } | null;

  /** Заказов за период, без привязанных. */
  ordersCount: number;

  /** Возвраты: оформленные и заявленные. */
  returnsCount: number;
  /** Доля возвратов от числа заказов, в процентах с одним знаком. */
  returnsShare: number;

  /** Отменённые: отменённые и ожидающие отмены. В выручку не входят. */
  cancelledCount: number;

  /**
   * Деньги, десятичной строкой в тенге.
   *
   * `totalRevenue` = `netRevenue` + `inTransit`. Отменённые и возвраты
   * не входят ни в одно из трёх: это не выручка.
   */
  totalRevenue: string;
  /** Незавершённые заказы: деньги в пути. */
  inTransit: string;
  /** Доставленные заказы: чистая выручка. */
  netRevenue: string;

  /** Сколько заказов точки привязано к площадке и на какую сумму. Справочно. */
  linkedCount: number;
  linkedAmount: string;
}

/** Период считает клиент: только он знает часовой пояс пользователя. */
export interface OrderStatsQuery {
  from?: string;
  to?: string;
}

export interface OrderStatsResponse {
  from: string | null;
  to: string | null;
  /** Сводка по всем точкам вместе. */
  total: OrderStatsCard;
  /** По точке на карточку, в порядке справочника. */
  points: OrderStatsCard[];
}
