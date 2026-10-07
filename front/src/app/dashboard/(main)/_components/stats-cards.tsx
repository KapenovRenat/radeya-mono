"use client";

import {OrderStatsCard, PERMISSIONS} from "@radeya/shared";

import { formatMoney, moneyToNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import styles from "./stats.module.scss";
import {useCan} from "@/features/auth/use-can";

/** Деньги для плашки: пусто и ноль показываем одинаково — «0 ₸». */
function money(value: string): string {
  return formatMoney(moneyToNumber(value) ?? 0);
}

interface StatsCardsProps {
  card: OrderStatsCard;
  /** Заголовок группы: название точки или «Всего». */
  title: string;
  /** Подпись рядом с заголовком: вид точки. */
  badge?: string;
  /** Итоговая полоса рисуется иначе — это сумма всего, а не ещё одна точка. */
  isTotal?: boolean;
}

/**
 * Плашки одной точки продаж.
 *
 * Пять чисел, и они связаны между собой: общая выручка = чистая + деньги
 * в пути. Отменённые и возвраты в деньги не входят ни в одно из трёх —
 * это не выручка, и складывать её с несостоявшейся продажей нельзя.
 */
export function StatsCards({ card, title, badge, isTotal }: StatsCardsProps) {
  const can = useCan();

  return (
    <section className={cn(styles.group, isTotal && styles.totalGroup)}>
      <div className={styles.groupHead}>
        <h3 className={styles.groupTitle}>{title}</h3>
        {badge !== undefined && <span className={styles.badge}>{badge}</span>}
      </div>

      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Заказов</span>
          <span className={styles.cardValue}>{card.ordersCount}</span>
          {card.cancelledCount > 0 && (
            <span className={styles.cardNote}>из них отменено {card.cancelledCount}</span>
          )}
        </div>

        <div className={cn(styles.card, card.returnsCount > 0 && styles.cardWarn)}>
          <span className={styles.cardLabel}>Возвраты</span>
          <span className={styles.cardValue}>{card.returnsCount}</span>
          <span className={styles.cardNote}>{card.returnsShare}% от заказов</span>
        </div>

        {can(PERMISSIONS.STATS_MONEY) ? <div className={styles.card}>
          <span className={styles.cardLabel}>Общая выручка</span>
          <span className={styles.cardValue}>{money(card.totalRevenue)}</span>
          <span className={styles.cardNote}>без отменённых и возвратов</span>
        </div> : null}

        {can(PERMISSIONS.STATS_MONEY) ? <div className={styles.card}>
          <span className={styles.cardLabel}>Деньги в пути</span>
          <span className={styles.cardValue}>{money(card.inTransit)}</span>
          <span className={styles.cardNote}>заказы ещё не завершены</span>
        </div> : null}

        {can(PERMISSIONS.STATS_MONEY) ? <div className={cn(styles.card, styles.cardDone)}>
          <span className={styles.cardLabel}>Чистая выручка</span>
          <span className={styles.cardValue}>{money(card.netRevenue)}</span>
          <span className={styles.cardNote}>доставленные заказы</span>
        </div> : null}
      </div>

      {/* Привязанные заказы в суммы выше не вошли: та же продажа посчитана
          на площадке, и сложить их значило бы удвоить выручку. */}
      {card.linkedCount > 0 && (
        <p className={styles.linked}>
          Ещё {card.linkedCount} заказов на {money(card.linkedAmount)} относятся
          к заказам площадки и в суммы не включены.
        </p>
      )}
    </section>
  );
}
