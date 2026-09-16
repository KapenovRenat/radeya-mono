"use client";

import { useCallback, useState } from "react";
import type {
  SaveWarehousesRequest,
  SaveWarehousesResponse,
} from "@radeya/shared";

import { apiErrorMessage } from "@/shared/api/error-message";
import { useImportKaspiWarehousesMutation } from "./warehouses-api";

/**
 * Склад в виде, пригодном для импорта.
 *
 * Форма, а не конкретный тип источника: склады приходят и из XML-выгрузки
 * (`KaspiCatalogWarehouse`), и из обхода кабинета (`CabinetWarehouse`).
 * Счётчики необязательны — в выгрузке остатка по складу нет.
 */
type ImportableWarehouse = SaveWarehousesRequest["warehouses"][number];

/**
 * Сохранение складов в справочник — из предпросмотра выгрузки или из кабинета.
 *
 * Отдельно от товаров: склады — справочник, он заводится один раз и не ждёт,
 * пока мы разберёмся с разбором названий и артикулов.
 */
export function useSaveWarehouses() {
  const [save, { isLoading }] = useImportKaspiWarehousesMutation();
  const [result, setResult] = useState<SaveWarehousesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveWarehouses = useCallback(
    async (warehouses: readonly ImportableWarehouse[]) => {
      setError(null);
      setResult(null);

      try {
        setResult(
          await save({
            // Счётчики уходят вместе со складом: в базе они лежат снимком
            // последней синхронизации — по ним видно общую картину до того,
            // как товары импортированы.
            warehouses: warehouses.map(
              ({ code, storeId, cityId, offersCount, totalStock }) => ({
                code,
                storeId,
                cityId,
                offersCount,
                totalStock,
              }),
            ),
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
