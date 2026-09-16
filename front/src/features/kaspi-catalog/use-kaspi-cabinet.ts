"use client";

import { useCallback, useState } from "react";
import type { CabinetSample, KaspiCabinetFetchResponse } from "@radeya/shared";

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

      logCabinetResponse(response);

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

/**
 * Разбор каталога в консоли браузера — инструмент этапа 2.
 *
 * На странице таблица показывает уже причёсанные значения, и по ней не видно,
 * из какого поля Kaspi что взялось. Здесь сырой товар лежит рядом со своим
 * разобранным видом: расхождение маппинга находится за один взгляд.
 *
 * Группы свёрнутые: иначе один товар с тремястами ценами по городам вытесняет
 * из консоли всё остальное.
 */
function logCabinetResponse(response: KaspiCabinetFetchResponse): void {
  console.groupCollapsed(
    `Kaspi: товаров ${response.total}, складов ${response.warehouses.length}, с проблемами ${response.withProblems}`,
  );

  for (const [index, sample] of response.sample.entries()) {
    logSample(index, sample);
  }

  console.log("Все разобранные товары:", response.offers);

  // Таблицей: у складов несколько одинаковых полей, столбцами они читаются.
  console.table(response.warehouses);

  console.groupEnd();
}

function logSample(index: number, sample: CabinetSample): void {
  const { parsed } = sample;

  console.groupCollapsed(
    `Образец ${index + 1}: ${parsed.sku || "без артикула"} — ${parsed.title || "без названия"}`,
  );

  console.log("Как отдал Kaspi:", sample.raw);
  console.log("Как разобрали мы:", parsed);

  if (parsed.problems.length > 0) {
    console.warn("Проблемы разбора:", parsed.problems);
  }

  console.groupEnd();
}
