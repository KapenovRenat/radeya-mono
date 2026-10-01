"use client";

import { useCallback, useRef, useState } from "react";
import type { KaspiOrderPeriod, SyncKaspiOrdersResponse } from "@radeya/shared";

import { apiErrorMessage } from "@/shared/api/error-message";
import { useSyncKaspiOrdersMutation, useSyncOrdersCabinetMutation } from "./orders-api";

/**
 * Предел шагов дат прибытия за один прогон: шаг — до 20 заказов, активных
 * обычно десятки. Предел — страховка от бесконечного цикла, а не норма.
 */
const MAX_CABINET_STEPS = 20;

/** Итог всего прогона: шаги складываются, потому что сервер считает только свой. */
export interface SyncTotals {
  created: number;
  updated: number;
  skipped: number;
  withProblems: number;
  ordersSeen: number;
  chunksDone: number;
  chunksTotal: number;
  unknownValues: string[];
  unknownWarehouses: string[];
}

const EMPTY: SyncTotals = {
  created: 0, updated: 0, skipped: 0, withProblems: 0, ordersSeen: 0,
  chunksDone: 0, chunksTotal: 0, unknownValues: [], unknownWarehouses: [],
};

/**
 * Синхронизация заказов из Kaspi.
 *
 * Сервер за вызов обрабатывает пачку трёхдневных отрезков и возвращает курсор —
 * два года это 244 отрезка, в один запрос они не укладываются. Хук крутит шаги
 * до `done` и складывает счётчики, чтобы страница показывала прогресс, а не
 * висела молча несколько минут.
 */
export function useKaspiOrdersSync() {
  const [period, setPeriod] = useState<KaspiOrderPeriod | null>(null);
  const [totals, setTotals] = useState<SyncTotals>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const cancelled = useRef(false);
  const running = useRef(false);
  const [syncOrders] = useSyncKaspiOrdersMutation();
  const [syncCabinet] = useSyncOrdersCabinetMutation();
  /** Даты прибытия из кабинета: скольких заказов спросили и у скольких поменялась. */
  const [cabinet, setCabinet] = useState({ checked: 0, changed: 0 });

  const merge = (previous: SyncTotals, step: SyncKaspiOrdersResponse): SyncTotals => ({
    created: previous.created + step.created,
    updated: previous.updated + step.updated,
    skipped: previous.skipped + step.skipped,
    withProblems: previous.withProblems + step.withProblems,
    ordersSeen: previous.ordersSeen + step.ordersSeen,
    // Пройдено и всего — это состояние, а не сумма: берём последнее известное.
    chunksDone: step.chunksDone,
    chunksTotal: step.chunksTotal,
    unknownValues: [...new Set([...previous.unknownValues, ...step.unknownValues])].sort(),
    unknownWarehouses: [...new Set([...previous.unknownWarehouses, ...step.unknownWarehouses])].sort(),
  });

  const start = useCallback(async (next: KaspiOrderPeriod) => {
    // Две кнопки рядом: без этого второе нажатие запустит второй обход Kaspi.
    if (running.current) return;

    running.current = true;
    cancelled.current = false;
    setPeriod(next);
    setTotals(EMPTY);
    setCabinet({ checked: 0, changed: 0 });
    setError(null);
    setIsRunning(true);

    // Правый край периода фиксируем один раз и повторяем на каждом шаге:
    // иначе окно поехало бы за временем, пока идут минуты обхода.
    const to = new Date().toISOString();
    let cursor: string | undefined;

    try {
      for (;;) {
        const step = await syncOrders({ period: next, to, cursor }).unwrap();

        setTotals((previous) => merge(previous, step));

        if (step.done || step.nextCursor === null) break;
        // Остановка пользователем: недоделанный период не страшен — повторный
        // прогон начнёт заново и просто обновит уже сохранённое.
        if (cancelled.current) break;

        cursor = step.nextCursor;
      }
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Не удалось синхронизировать заказы"));
      // Заказы не дошли — даты прибытия догонять не к чему.
      cancelled.current = true;
    }

    // Следом — «Планируемая дата прибытия» из кабинета для активных заказов.
    // Отдельным шагом: заказы из Shop API уже записаны, и сбой кабинета
    // не должен выглядеть как сбой синхронизации.
    try {
      for (let step = 0; step < MAX_CABINET_STEPS && !cancelled.current; step += 1) {
        const result = await syncCabinet().unwrap();

        setCabinet((previous) => ({
          checked: previous.checked + result.processed,
          changed: previous.changed + result.changed,
        }));

        // Пусто или шаг ничего не взял — дальше крутить бессмысленно.
        if (result.remaining === 0 || result.processed === 0) break;
      }
    } catch (requestError) {
      setError(apiErrorMessage(
        requestError, "Заказы синхронизированы, но даты прибытия из кабинета Kaspi не обновились",
      ));
    } finally {
      running.current = false;
      setIsRunning(false);
    }
  }, [syncOrders, syncCabinet]);

  const cancel = useCallback(() => {
    cancelled.current = true;
  }, []);

  const progress = totals.chunksTotal === 0
    ? 0
    : Math.round((totals.chunksDone / totals.chunksTotal) * 100);

  return { start, cancel, isRunning, period, totals, cabinet, progress, error };
}
