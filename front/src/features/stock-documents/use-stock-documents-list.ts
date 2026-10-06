"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CATALOG_DEFAULT_PAGE_SIZE,
  CATALOG_PAGE_SIZES,
  parseStockDocumentNumber,
  type CatalogPageSize,
  type StockDocumentListQuery,
  type StockDocumentType,
} from "@radeya/shared";

import { apiErrorMessage } from "@/shared/api/error-message";
import { useGetStockDocumentsQuery } from "./stock-documents-api";

/** Пауза перед запросом, чтобы не стрелять на каждую цифру номера. */
const NUMBER_DELAY_MS = 300;

/**
 * Список документов склада: страница, фильтры по виду и складу, поиск по номеру.
 * Пустая строка в фильтре — «все».
 */
export function useStockDocumentsList() {
  const [numberInput, setNumberInput] = useState("");
  const [query, setQuery] = useState<StockDocumentListQuery>({
    page: 1, pageSize: CATALOG_DEFAULT_PAGE_SIZE,
  });

  // Номер ищется целиком: «12» не найдёт «00128». Не номер — фильтр не ставится.
  const parsedNumber = parseStockDocumentNumber(numberInput);
  const appliedNumber = parsedNumber === null ? undefined : String(parsedNumber);
  const isNumberPending = appliedNumber !== query.number;
  const documents = useGetStockDocumentsQuery(query, { skip: isNumberPending });

  useEffect(() => {
    if (!isNumberPending) return;

    const timer = setTimeout(() => {
      setQuery((previous) => ({ ...previous, number: appliedNumber, page: 1 }));
    }, NUMBER_DELAY_MS);

    return () => clearTimeout(timer);
  }, [appliedNumber, isNumberPending]);

  const setType = useCallback((type: string) => {
    setQuery((previous) => ({
      ...previous,
      type: type === "" ? undefined : (type as StockDocumentType),
      page: 1,
    }));
  }, []);

  const setWarehouseId = useCallback((warehouseId: string) => {
    setQuery((previous) => ({ ...previous, warehouseId: warehouseId === "" ? undefined : warehouseId, page: 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    if (!Number.isSafeInteger(page) || page < 1) return;
    setQuery((previous) => ({ ...previous, page }));
  }, []);

  const setPageSize = useCallback((pageSize: CatalogPageSize) => {
    if (!CATALOG_PAGE_SIZES.includes(pageSize)) return;
    setQuery((previous) => ({ ...previous, pageSize, page: 1 }));
  }, []);

  // currentData, а не data: иначе под новым фильтром на миг видны старые строки.
  const current = isNumberPending || documents.isError ? undefined : documents.currentData;

  return {
    items: current?.items ?? [],
    total: current?.total ?? 0,
    page: current?.page ?? query.page ?? 1,
    pageSize: query.pageSize ?? CATALOG_DEFAULT_PAGE_SIZE,
    setPage,
    setPageSize,
    type: query.type ?? "",
    setType,
    warehouseId: query.warehouseId ?? "",
    setWarehouseId,
    numberInput,
    setNumberInput,
    isLoading: documents.isLoading || documents.isFetching || isNumberPending,
    error: documents.isError ? apiErrorMessage(documents.error, "Не удалось загрузить документы") : null,
    reload: () => { if (!isNumberPending) void documents.refetch(); },
  };
}
