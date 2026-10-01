"use client";

import { useCallback, useEffect, useRef } from "react";

import { apiErrorMessage } from "@/shared/api/error-message";
import { useGetOrderQuery, useSyncOrderCabinetMutation, useSyncOrderEntriesMutation } from "./orders-api";

/**
 * Данные окна заказа.
 *
 * Заказ открывается сразу из базы. Если это заказ Kaspi и состав ещё
 * не загружали — хук сам просит сервер забрать его у площадки, и пока идёт
 * запрос, крутится загрузчик только в блоке «Состав»: остальное уже видно.
 * Второй раз заказ открывается готовым, без запроса к Kaspi.
 *
 * `orderId === null` — окно закрыто, ничего не запрашивается.
 */
export function useOrderDetails(orderId: string | null) {
  const order = useGetOrderQuery(orderId ?? "", { skip: orderId === null });
  const [syncEntries, sync] = useSyncOrderEntriesMutation();

  // Один автоматический запрос на заказ: при ошибке Kaspi не долбим площадку
  // в цикле — повтор только по кнопке.
  const requested = useRef<string | null>(null);

  // Состояние загрузки состава — про один заказ: открыли другой, и ошибка
  // прошлого не должна висеть в его окне.
  const { reset } = sync;

  useEffect(() => {
    reset();
  }, [orderId, reset]);

  const data = order.currentData;
  const needsEntries = data !== undefined && data.canLoadEntries && !data.entriesLoaded;

  useEffect(() => {
    if (orderId === null || !needsEntries || requested.current === orderId) return;

    requested.current = orderId;
    void syncEntries(orderId);
  }, [orderId, needsEntries, syncEntries]);

  const retryEntries = useCallback(() => {
    if (orderId !== null) void syncEntries(orderId);
  }, [orderId, syncEntries]);

  // Дата прибытия из кабинета — так же, один раз на заказ: сервер сам говорит,
  // пора ли перечитать (активный заказ, дату не спрашивали больше часа).
  const [syncCabinet, cabinet] = useSyncOrderCabinetMutation();
  const cabinetRequested = useRef<string | null>(null);
  const { reset: resetCabinet } = cabinet;

  useEffect(() => {
    resetCabinet();
  }, [orderId, resetCabinet]);

  const needsCabinet = data !== undefined && data.cabinetRefreshDue;

  useEffect(() => {
    if (orderId === null || !needsCabinet || cabinetRequested.current === orderId) return;

    cabinetRequested.current = orderId;
    void syncCabinet(orderId);
  }, [orderId, needsCabinet, syncCabinet]);

  return {
    order: data ?? null,
    isLoading: order.isLoading || order.isFetching,
    error: order.isError ? apiErrorMessage(order.error, "Не удалось загрузить заказ") : null,
    reload: order.refetch,
    /** Состав сейчас забирается с площадки. */
    isLoadingEntries: sync.isLoading,
    entriesError: sync.isError
      ? apiErrorMessage(sync.error, "Не удалось загрузить состав заказа из Kaspi")
      : null,
    retryEntries,
    /** Дата прибытия сейчас запрашивается в кабинете Kaspi. */
    isLoadingCabinet: cabinet.isLoading,
    cabinetError: cabinet.isError
      ? apiErrorMessage(cabinet.error, "Кабинет Kaspi не ответил")
      : null,
  };
}
