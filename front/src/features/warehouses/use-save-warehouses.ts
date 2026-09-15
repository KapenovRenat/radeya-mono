"use client";

import { useCallback, useState } from "react";
import type {
  KaspiCatalogWarehouse,
  SaveWarehousesResponse,
} from "@radeya/shared";

import { apiErrorMessage } from "@/shared/api/error-message";
import { useImportKaspiWarehousesMutation } from "./warehouses-api";

/**
 * Сохранение складов из предпросмотра выгрузки в справочник.
 *
 * Отдельно от товаров: склады — справочник, он заводится один раз и не ждёт,
 * пока мы разберёмся с разбором названий и артикулов.
 */
export function useSaveWarehouses() {
  const [save, { isLoading }] = useImportKaspiWarehousesMutation();
  const [result, setResult] = useState<SaveWarehousesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveWarehouses = useCallback(
    async (warehouses: KaspiCatalogWarehouse[]) => {
      setError(null);
      setResult(null);

      try {
        setResult(
          await save({
            // offersCount на сервер не отправляем: это счётчик текущей выгрузки,
            // а не свойство склада.
            warehouses: warehouses.map(({ code, storeId, cityId }) => ({
              code,
              storeId,
              cityId,
            })),
          }).unwrap(),
        );
      } catch (requestError) {
        setError(apiErrorMessage(requestError, "Не удалось сохранить склады"));
      }
    },
    [save],
  );

  return { saveWarehouses, isSaving: isLoading, result, error };
}
