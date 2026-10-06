"use client";

import { useCallback, useEffect, useState } from "react";
import { CATALOG_SEARCH_MAX_LENGTH, type StockVariantDto } from "@radeya/shared";

import { apiErrorMessage } from "@/shared/api/error-message";
import { useGetStockPickerVariantsQuery } from "./stock-documents-api";

/** Пауза перед запросом, чтобы не стрелять на каждую букву. */
const SEARCH_DELAY_MS = 300;

/**
 * Окно выбора товаров в документ.
 *
 * Выбранное копится по всем страницам и поискам: нашёл «Мадрид», отметил,
 * нашёл «Орео», отметил — в документ уйдут оба. Поэтому выбор хранится
 * товарами целиком, а не id: товара с прошлой страницы в текущем ответе нет.
 *
 * Пока окно закрыто или склад не выбран, запросов нет.
 */
export function useStockPicker(warehouseId: string, onConfirm: (variants: StockVariantDto[]) => void) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearchValue] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Map<string, StockVariantDto>>(() => new Map());

  const isSearchPending = search.trim() !== appliedSearch;
  const skip = !isOpen || warehouseId === "" || isSearchPending;
  const variants = useGetStockPickerVariantsQuery({ warehouseId, search: appliedSearch, page }, { skip });

  useEffect(() => {
    if (!isSearchPending) return;

    const timer = setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [search, isSearchPending]);

  const open = useCallback(() => {
    setSelected(new Map());
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const setSearch = useCallback((value: string) => {
    setSearchValue(value.slice(0, CATALOG_SEARCH_MAX_LENGTH));
  }, []);

  const toggle = useCallback((variant: StockVariantDto) => {
    setSelected((current) => {
      const next = new Map(current);

      if (next.has(variant.id)) next.delete(variant.id);
      else next.set(variant.id, variant);

      return next;
    });
  }, []);

  const confirm = useCallback(() => {
    onConfirm([...selected.values()]);
    setIsOpen(false);
  }, [onConfirm, selected]);

  const current = skip || variants.isError ? undefined : variants.currentData;

  return {
    isOpen, open, close,
    search, setSearch,
    items: current?.items ?? [],
    page: current?.page ?? page,
    totalPages: current?.totalPages ?? 0,
    setPage,
    selectedIds: [...selected.keys()],
    toggle,
    confirm,
    isLoading: variants.isLoading || variants.isFetching || isSearchPending,
    error: variants.isError ? apiErrorMessage(variants.error, "Не удалось загрузить товары") : null,
  };
}
