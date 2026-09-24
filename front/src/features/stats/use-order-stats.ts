"use client";

import { useCallback, useState } from "react";
import type { OrderStatsQuery } from "@radeya/shared";

import type { DateRange } from "@/components/date-range-picker";
import { currentMonth, previousMonth, toMoment } from "@/lib/day-range";
import { apiErrorMessage } from "@/shared/api/error-message";
import { useGetOrderStatsQuery } from "./stats-api";

const EMPTY_RANGE: DateRange = { from: null, to: null };

/** Готовые периоды: их выбирают чаще, чем тыкают в календарь. */
export type StatsPreset = "current" | "previous";

/**
 * Сводка по заказам за период.
 *
 * Период по умолчанию — текущий месяц: открывая статистику, смотрят «как идут
 * дела сейчас», а не за всё время. Без периода сервер посчитал бы все заказы
 * за два года, и цифра была бы бессмысленной.
 */
export function useOrderStats() {
  const [range, setRangeValue] = useState<DateRange>(EMPTY_RANGE);
  const [preset, setPreset] = useState<StatsPreset | null>("current");
  const [query, setQuery] = useState<OrderStatsQuery>(currentMonth());

  const stats = useGetOrderStatsQuery(query);

  const applyPreset = useCallback((next: StatsPreset) => {
    setPreset(next);
    // Календарь очищаем: иначе в нём остаются даты прошлого выбора,
    // а показана сводка за другой период.
    setRangeValue(EMPTY_RANGE);
    setQuery(next === "current" ? currentMonth() : previousMonth());
  }, []);

  /** Выбор в календаре отменяет готовый период: активным остаётся что-то одно. */
  const setRange = useCallback((next: DateRange) => {
    setRangeValue(next);
    setPreset(null);
    setQuery({
      from: toMoment(next.from, "start"),
      to: toMoment(next.to, "end"),
    });
  }, []);

  return {
    range,
    setRange,
    preset,
    applyPreset,
    total: stats.data?.total ?? null,
    points: stats.data?.points ?? [],
    isLoading: stats.isLoading || stats.isFetching,
    error: stats.isError
      ? apiErrorMessage(stats.error, "Не удалось посчитать статистику")
      : null,
  };
}
