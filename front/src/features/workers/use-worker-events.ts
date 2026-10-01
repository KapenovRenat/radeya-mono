"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CATALOG_DEFAULT_PAGE_SIZE,
  CATALOG_PAGE_SIZES,
  WORKER_EVENT_ORDER_CODE_MAX_LENGTH,
  type CatalogPageSize,
  type WorkerEventType,
  type WorkerKey,
} from "@radeya/shared";

import { apiErrorMessage } from "@/shared/api/error-message";
import { useGetWorkerEventsQuery } from "./workers-api";

/** Пауза перед запросом, чтобы не стрелять на каждую цифру номера заказа. */
const SEARCH_DELAY_MS = 300;

/** Журнал пополняется циклами воркера (1–10 мин) — опрос как у состояния воркера. */
const EVENTS_POLL_MS = 15_000;

interface EventsFilter {
  page: number;
  pageSize: CatalogPageSize;
  type: WorkerEventType | "";
  orderCode: string;
}

/**
 * Журнал воркера для таблицы в настройках: страница, вид события, номер заказа.
 * Обновляется сам — новые события появляются без перезагрузки страницы.
 */
export function useWorkerEvents(key: WorkerKey) {
  const [orderCodeInput, setOrderCodeInput] = useState("");
  const [filter, setFilter] = useState<EventsFilter>({
    page: 1, pageSize: CATALOG_DEFAULT_PAGE_SIZE, type: "", orderCode: "",
  });

  const isSearchPending = orderCodeInput.trim() !== filter.orderCode;
  const events = useGetWorkerEventsQuery({
    key,
    page: filter.page,
    pageSize: filter.pageSize,
    ...(filter.type ? { type: filter.type } : {}),
    ...(filter.orderCode ? { orderCode: filter.orderCode } : {}),
  }, { skip: isSearchPending, pollingInterval: EVENTS_POLL_MS });

  useEffect(() => {
    if (!isSearchPending) return;

    const timer = setTimeout(() => {
      setFilter((previous) => ({ ...previous, orderCode: orderCodeInput.trim(), page: 1 }));
    }, SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [orderCodeInput, isSearchPending]);

  /** Номер заказа — только цифры: сервер другого не примет. */
  const setOrderCode = useCallback((value: string) => {
    setOrderCodeInput(value.replace(/\D/g, "").slice(0, WORKER_EVENT_ORDER_CODE_MAX_LENGTH));
  }, []);

  const setType = useCallback((type: WorkerEventType | "") => {
    setFilter((previous) => ({ ...previous, type, page: 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    if (!Number.isSafeInteger(page) || page < 1) return;
    setFilter((previous) => ({ ...previous, page }));
  }, []);

  const setPageSize = useCallback((pageSize: CatalogPageSize) => {
    if (!CATALOG_PAGE_SIZES.includes(pageSize)) return;
    setFilter((previous) => ({ ...previous, pageSize, page: 1 }));
  }, []);

  // currentData, а не data: под новым фильтром не видны строки старого.
  const current = isSearchPending || events.isError ? undefined : events.currentData;

  return {
    items: current?.items ?? [],
    total: current?.total ?? 0,
    page: current?.page ?? filter.page,
    pageSize: filter.pageSize,
    setPage, setPageSize,
    type: filter.type, setType,
    orderCode: orderCodeInput, setOrderCode,
    // Опрос раз в 15 с не должен мигать загрузкой — только смена фильтра или страницы.
    isLoading: isSearchPending || (events.isFetching && events.currentData === undefined),
    error: events.isError ? apiErrorMessage(events.error, "Не удалось загрузить журнал воркера") : null,
    reload: () => { if (!isSearchPending) void events.refetch(); },
  };
}
