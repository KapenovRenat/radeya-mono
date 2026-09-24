"use client";

import { SALES_POINT_TYPE_LABELS, SALES_POINT_TYPES } from "@radeya/shared";

import { Button } from "@/components/button";
import { DateRangePicker } from "@/components/date-range-picker";
import { Loader } from "@/components/loader";
import { useOrderStats } from "@/features/stats/use-order-stats";
import { cn } from "@/lib/utils";
import { StatsCards } from "./stats-cards";
import styles from "./stats.module.scss";

/**
 * Сводка по заказам за период.
 *
 * Сверху период, ниже итог по всем точкам и отдельный блок на каждую точку.
 * Порядок именно такой: сначала «сколько всего», потом «откуда это взялось» —
 * обратный порядок заставляет складывать цифры в уме.
 */
export function StatsBlock() {
  const stats = useOrderStats();

  const kaspi = stats.points.filter(
    (card) => card.salesPoint?.type !== SALES_POINT_TYPES.OFFLINE,
  );
  const offline = stats.points.filter(
    (card) => card.salesPoint?.type === SALES_POINT_TYPES.OFFLINE,
  );

  return (
    <div className={styles.stats}>
      <div className={styles.period}>
        <span className={cn(stats.preset === "current" && styles.presetActive)}>
          <Button type="button" onClick={() => stats.applyPreset("current")}>
            Текущий месяц
          </Button>
        </span>

        <span className={cn(stats.preset === "previous" && styles.presetActive)}>
          <Button type="button" onClick={() => stats.applyPreset("previous")}>
            Прошлый месяц
          </Button>
        </span>

        <DateRangePicker
          label="Свой период"
          value={stats.range}
          onChange={stats.setRange}
        />

        {stats.isLoading && <Loader size={28} hideLabel />}
      </div>

      {stats.error && <p role="alert" className={styles.error}>{stats.error}</p>}

      {stats.total !== null && stats.points.length > 0 && (
        <StatsCards card={stats.total} title="Всего" isTotal />
      )}

      {kaspi.map((card) => (
        <StatsCards
          key={card.salesPoint?.id}
          card={card}
          title={card.salesPoint?.name ?? "—"}
          badge={card.salesPoint ? SALES_POINT_TYPE_LABELS[card.salesPoint.type] : undefined}
        />
      ))}

      {offline.map((card) => (
        <StatsCards
          key={card.salesPoint?.id}
          card={card}
          title={card.salesPoint?.name ?? "—"}
          badge="Офлайн-точка"
        />
      ))}

      {/* Точки без заказов за период сервер не присылает вовсе: карточка
          из одних нулей занимает место и ничего не сообщает. */}
      {!stats.isLoading && stats.points.length === 0 && stats.error === null && (
        <p className={styles.empty}>За выбранный период заказов нет.</p>
      )}
    </div>
  );
}
