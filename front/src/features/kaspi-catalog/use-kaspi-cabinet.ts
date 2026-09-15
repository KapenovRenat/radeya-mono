"use client";

import { useCallback, useState } from "react";
import type { KaspiCabinetFetchResponse } from "@radeya/shared";

import { apiErrorMessage } from "@/shared/api/error-message";
import { useFetchKaspiCabinetMutation } from "./kaspi-catalog-api";

/**
 * Загрузка каталога из кабинета Kaspi.
 *
 * Кука живёт только в состоянии этой формы и в памяти сервера, если выбрано
 * «запомнить». Ни в localStorage, ни в куки браузера её не кладём: оттуда её
 * достанет любой скрипт на странице.
 */
export function useKaspiCabinet() {
  const [cookie, setCookie] = useState("");
  const [remember, setRemember] = useState(false);
  const [result, setResult] = useState<KaspiCabinetFetchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchCabinet, { isLoading }] = useFetchKaspiCabinetMutation();

  const load = useCallback(async () => {
    setError(null);
    setResult(null);

    try {
      const response = await fetchCabinet({
        // Пустое поле — на сервере возьмётся запомненная кука.
        cookie: cookie.trim() || undefined,
        remember,
      }).unwrap();

      setResult(response);

      // Запомнили на сервере — держать её здесь больше незачем.
      if (remember) setCookie("");
    } catch (requestError) {
      setError(
        apiErrorMessage(requestError, "Не удалось загрузить каталог из кабинета"),
      );
    }
  }, [cookie, remember, fetchCabinet]);

  return {
    cookie,
    setCookie,
    remember,
    setRemember,
    load,
    isLoading,
    result,
    error,
  };
}
