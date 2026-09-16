"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  CabinetOffer,
  ImportKaspiProductsResponse,
} from "@radeya/shared";

import { apiErrorMessage } from "@/shared/api/error-message";
import {
  useGetKnownSkusQuery,
  useImportKaspiProductsMutation,
} from "./products-api";

/**
 * Сколько товаров уходит на сервер за один запрос.
 *
 * Весь каталог — около пяти мегабайт: у каждого товара картинки и история
 * изменений кабинета. Общий лимит тела запроса — 1 МБ, и поднимать его ради
 * одной кнопки не стоит: сотня товаров укладывается в треть мегабайта,
 * а заодно видно прогресс и сбой не отменяет уже сохранённое.
 */
const BATCH_SIZE = 100;

/**
 * Сохранение товаров кабинета в каталог.
 *
 * Делит загруженное на новое и уже сохранённое: в базу и в таблицу идёт
 * только новое. Смотреть каждый раз полторы тысячи строк, из которых
 * изменились три, невозможно — а именно так выглядит вторая синхронизация.
 *
 * Сравнение по артикулу: это ключ, по которому товар склеивается и с кабинетом,
 * и с позициями заказов.
 */
export function useImportKaspiProducts(offers: readonly CabinetOffer[]) {
  const { data: known, isLoading: isLoadingSkus } = useGetKnownSkusQuery();
  const [importProducts, { isLoading: isSaving }] =
    useImportKaspiProductsMutation();

  const [result, setResult] = useState<ImportKaspiProductsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  const knownSkus = useMemo(
    () => new Set(known?.skus ?? []),
    [known],
  );

  const newOffers = useMemo(
    () => offers.filter((offer) => !knownSkus.has(offer.sku)),
    [offers, knownSkus],
  );

  const save = useCallback(async () => {
    setError(null);
    setResult(null);
    setSavedCount(0);

    const total: ImportKaspiProductsResponse = {
      created: 0,
      skipped: 0,
      failed: [],
      missingWarehouses: [],
    };

    const missingWarehouses = new Set<string>();

    try {
      for (let from = 0; from < newOffers.length; from += BATCH_SIZE) {
        const batch = newOffers.slice(from, from + BATCH_SIZE);
        const answer = await importProducts({ offers: batch }).unwrap();

        total.created += answer.created;
        total.skipped += answer.skipped;
        total.failed.push(...answer.failed);
        answer.missingWarehouses.forEach((code) => missingWarehouses.add(code));

        // Новый объект на каждой пачке: иначе React не увидит изменения
        // и итог появится только в самом конце.
        setResult({
          ...total,
          failed: [...total.failed],
          missingWarehouses: [...missingWarehouses].sort(),
        });
        setSavedCount(from + batch.length);
      }
    } catch (requestError) {
      // Пачки, прошедшие до сбоя, уже в базе — их итог остаётся на экране.
      setError(apiErrorMessage(requestError, "Не удалось сохранить товары"));
    }
  }, [importProducts, newOffers]);

  return {
    /** Товары, которых ещё нет в базе. Их и показываем, их и сохраняем. */
    newOffers,
    /** Сколько из загруженного уже лежит в каталоге. */
    knownCount: offers.length - newOffers.length,
    /** Пока список артикулов не пришёл, «новых нет» показывать нельзя — соврём. */
    isChecking: isLoadingSkus,
    save,
    isSaving,
    /** Сколько товаров уже ушло на сервер — для прогресса на кнопке. */
    savedCount,
    result,
    error,
  };
}
