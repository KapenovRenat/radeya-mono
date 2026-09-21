"use client";

import { useCallback, useEffect, useState } from "react";
import { CATALOG_DEFAULT_PAGE_SIZE, CATALOG_PAGE_SIZES, CATALOG_SEARCH_MAX_LENGTH,
  type CatalogPageSize, type OrderListQuery } from "@radeya/shared";

import type { DateRange } from "@/components/date-range-picker";
import { apiErrorMessage } from "@/shared/api/error-message";
import { useGetOrdersQuery } from "./orders-api";

/** Пауза перед запросом, чтобы не стрелять на каждую букву в поиске. */
const SEARCH_DELAY_MS = 300;

const EMPTY_RANGE: DateRange = { from: null, to: null };

/**
 * Выбранная дата в момент времени.
 *
 * `YYYY-MM-DD` из пикера — это сутки **в поясе пользователя**, и переводить
 * их в момент должен клиент: сервер не знает, где сидит человек, а «за
 * 21 сентября» в Алматы и в UTC — разные наборы заказов.
 *
 * Начало суток для левой границы, конец — для правой, чтобы обе попадали
 * внутрь периода.
 */
function toMoment(date: string | null, edge: "start" | "end"): string | undefined {
  if (date === null) return undefined;

  const [year, month, day] = date.split("-").map(Number);

  if (year === undefined || month === undefined || day === undefined) return undefined;

  const moment = edge === "start"
    ? new Date(year, month - 1, day, 0, 0, 0, 0)
    : new Date(year, month - 1, day, 23, 59, 59, 999);

  return Number.isNaN(moment.getTime()) ? undefined : moment.toISOString();
}

/**
 * Список заказов для таблицы.
 *
 * Поиск серверный: заказов десятки тысяч, и отбирать их в браузере нечем —
 * на странице лежит только текущая страница.
 */
export function useOrdersList() {
  const [search, setSearchValue] = useState("");
  const [range, setRangeValue] = useState<DateRange>(EMPTY_RANGE);
  const [query, setQuery] = useState<OrderListQuery>({
    page: 1, pageSize: CATALOG_DEFAULT_PAGE_SIZE, search: "",
  });

  const isSearchPending = search.trim() !== query.search;
  const orders = useGetOrdersQuery(query, { skip: isSearchPending });

  useEffect(() => {
    if (!isSearchPending) return;

    const timer = setTimeout(() => {
      setQuery((previous) => ({ ...previous, search: search.trim(), page: 1 }));
    }, SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [search, isSearchPending]);

  const setSearch = useCallback((value: string) => {
    setSearchValue(value.slice(0, CATALOG_SEARCH_MAX_LENGTH));
  }, []);

  /** Период применяется сразу: дату выбирают целиком, посимвольного ввода нет. */
  const setRange = useCallback((next: DateRange) => {
    setRangeValue(next);
    setQuery((previous) => ({
      ...previous,
      from: toMoment(next.from, "start"),
      to: toMoment(next.to, "end"),
      page: 1,
    }));
  }, []);

  const setPage = useCallback((page: number) => {
    if (!Number.isSafeInteger(page) || page < 1) return;
    setQuery((previous) => ({ ...previous, page }));
  }, []);

  const setPageSize = useCallback((pageSize: CatalogPageSize) => {
    if (!CATALOG_PAGE_SIZES.includes(pageSize)) return;
    setQuery((previous) => ({ ...previous, pageSize, page: 1 }));
  }, []);

  // currentData, а не data: иначе под новым поиском на миг видны старые строки.
  const current = isSearchPending || orders.isError ? undefined : orders.currentData;

  return {
    items: current?.items ?? [],
    total: current?.total ?? 0,
    totalPages: current?.totalPages ?? 0,
    page: current?.page ?? query.page ?? 1,
    pageSize: query.pageSize ?? CATALOG_DEFAULT_PAGE_SIZE,
    setPage, setPageSize,
    search, setSearch,
    range, setRange,
    isLoading: orders.isLoading || orders.isFetching || isSearchPending,
    error: orders.isError ? apiErrorMessage(orders.error, "Не удалось загрузить заказы") : null,
    reload: () => { if (!isSearchPending) void orders.refetch(); },
  };
}
