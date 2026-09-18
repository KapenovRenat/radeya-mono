"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ALL_PRODUCTS_LABEL, CATALOG_DEFAULT_PAGE_SIZE, CATALOG_PAGE_SIZES,
  CATALOG_SEARCH_MAX_LENGTH, CATEGORY_NAME_MAX_LENGTH, type CatalogPageSize, type CatalogQuery,
  type CategoryDto, type CategoryTreeNode } from "@radeya/shared";
import { useGetCategoryTreeQuery } from "@/features/categories/categories-api";
import { apiErrorMessage } from "@/shared/api/error-message";
import { useGetCatalogQuery, useMoveProductsToCategoryMutation } from "./catalog-api";

const SEARCH_DELAY_MS = 300;

/** Сравнимый вид: регистр не важен, «ё» люди набирают как «е». */
const normalize = (value: string) => value.trim().toLowerCase().replace(/ё/g, "е");

/**
 * Отбор папок по названию.
 *
 * Дерево приходит целиком одним запросом, поэтому фильтруем на клиенте:
 * запрос на сервер за двумя уровнями папок — лишний круг.
 *
 * Совпал родитель — показываем его со всеми детьми. Совпал ребёнок —
 * показываем родителя с подошедшими детьми и раскрываем его: иначе
 * найденное прячется внутри свёрнутой папки, и поиск выглядит сломанным.
 */
function filterTree(items: CategoryTreeNode[], search: string) {
  const query = normalize(search);
  if (query === "") return { items, expand: [] as string[] };

  const matched: CategoryTreeNode[] = [];
  const expand: string[] = [];

  for (const parent of items) {
    if (normalize(parent.name).includes(query)) {
      matched.push(parent);
      continue;
    }
    const children = parent.children.filter((child) => normalize(child.name).includes(query));
    if (children.length === 0) continue;
    matched.push({ ...parent, children });
    expand.push(parent.id);
  }

  return { items: matched, expand };
}

/** Логика таблицы для ADMIN. items уже содержат страницу: повторно резать массив не нужно. */
export function useProductCatalog() {
  const [search, setSearchValue] = useState("");
  const [query, setQuery] = useState<CatalogQuery>({
    page: 1, pageSize: CATALOG_DEFAULT_PAGE_SIZE, search: "",
  });
  const [categorySearch, setCategorySearchValue] = useState("");
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moveResult, setMoveResult] = useState<number | null>(null);
  const moving = useRef(false);
  const tree = useGetCategoryTreeQuery();
  const isSearchPending = search.trim() !== query.search;
  const catalog = useGetCatalogQuery(query, { skip: isSearchPending });
  const [moveProducts, { isLoading: isMoving }] = useMoveProductsToCategoryMutation();

  useEffect(() => {
    if (!isSearchPending) return;
    const timer = setTimeout(() => {
      setQuery((previous) => ({ ...previous, search: search.trim(), page: 1 }));
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search, isSearchPending]);

  const resetSelection = useCallback(() => {
    setSelectedProductIds([]);
    setMoveError(null);
    setMoveResult(null);
  }, []);
  const setSearch = useCallback((value: string) => {
    setSearchValue(value.slice(0, CATALOG_SEARCH_MAX_LENGTH));
    resetSelection();
  }, [resetSelection]);
  const selectCategory = useCallback((id: string | null) => {
    setQuery((previous) => ({ ...previous, categoryId: id ?? undefined, page: 1 }));
    resetSelection();
  }, [resetSelection]);
  const setCategorySearch = useCallback((value: string) => {
    setCategorySearchValue(value.slice(0, CATEGORY_NAME_MAX_LENGTH));
  }, []);
  const toggleCategory = useCallback((id: string) => {
    setExpandedCategoryIds((previous) => previous.includes(id)
      ? previous.filter((value) => value !== id) : [...previous, id]);
  }, []);
  const onCategoryCreated = useCallback((category: CategoryDto) => {
    if (category.parentId) {
      const parentId = category.parentId;
      setExpandedCategoryIds((previous) => [...new Set([...previous, parentId])]);
    }
    selectCategory(category.id);
  }, [selectCategory]);
  const onCategoryDeleted = useCallback((category: CategoryDto) => {
    setQuery((previous) => previous.categoryId === category.id
      ? { ...previous, categoryId: category.parentId ?? undefined, page: 1 } : previous);
    setExpandedCategoryIds((previous) => previous.filter((id) => id !== category.id));
    resetSelection();
  }, [resetSelection]);
  const setPageSize = useCallback((pageSize: CatalogPageSize) => {
    if (!CATALOG_PAGE_SIZES.includes(pageSize)) return;
    setQuery((previous) => ({ ...previous, pageSize, page: 1 }));
    resetSelection();
  }, [resetSelection]);
  const setPage = useCallback((page: number) => {
    if (!Number.isSafeInteger(page) || page < 1) return;
    setQuery((previous) => ({ ...previous, page }));
    resetSelection();
  }, [resetSelection]);

  // currentData исключает показ строк старой папки/поиска под новым заголовком.
  const current = isSearchPending || catalog.isError ? undefined : catalog.currentData;
  const items = current?.items ?? [];
  const setProductSelected = useCallback((productId: string, selected: boolean) => {
    if (moving.current || isSearchPending || catalog.isFetching || catalog.isError) return;
    if (!catalog.currentData?.items.some((row) => row.productId === productId)) return;
    setSelectedProductIds((previous) => selected
      ? [...new Set([...previous, productId])]
      : previous.filter((id) => id !== productId));
    setMoveResult(null);
    setMoveError(null);
  }, [catalog.currentData, catalog.isFetching, catalog.isError, isSearchPending]);
  const selectPage = useCallback((selected: boolean) => {
    if (moving.current || isSearchPending || catalog.isFetching || catalog.isError) return;
    setSelectedProductIds(selected
      ? [...new Set(catalog.currentData?.items.map((row) => row.productId) ?? [])] : []);
    setMoveResult(null);
    setMoveError(null);
  }, [catalog.currentData, catalog.isFetching, catalog.isError, isSearchPending]);
  const moveSelected = useCallback(async (categoryId: string | null) => {
    if (moving.current || !selectedProductIds.length || isSearchPending || catalog.isFetching || catalog.isError) return false;
    moving.current = true;
    setMoveError(null);
    setMoveResult(null);
    const movingIds = selectedProductIds;
    try {
      const result = await moveProducts({ productIds: movingIds, categoryId }).unwrap();
      // Пользователь мог сменить папку во время запроса: новое выделение не сбрасываем.
      setSelectedProductIds((currentIds) => currentIds === movingIds ? [] : currentIds);
      setMoveResult(result.updated);
      return true;
    } catch (requestError) {
      setMoveError(apiErrorMessage(requestError, "Не удалось переместить товары"));
      return false;
    } finally {
      moving.current = false;
    }
  }, [moveProducts, selectedProductIds, isSearchPending, catalog.isFetching, catalog.isError]);

  const filtered = useMemo(
    () => filterTree(tree.data?.items ?? [], categorySearch),
    [tree.data, categorySearch],
  );

  return {
    allProducts: tree.data?.allProducts ?? { id: null, name: ALL_PRODUCTS_LABEL },
    categories: filtered.items,
    categorySearch, setCategorySearch,
    isLoadingCategories: tree.isLoading,
    categoriesError: tree.isError ? apiErrorMessage(tree.error, "Не удалось загрузить категории") : null,
    reloadCategories: tree.refetch,
    categoryId: query.categoryId ?? null, selectCategory,
    // Найденное поиском раскрываем поверх того, что человек раскрыл руками:
    // свой выбор он потом найдёт на месте, когда очистит поиск.
    expandedCategoryIds: [...new Set([...expandedCategoryIds, ...filtered.expand])],
    toggleCategory, onCategoryCreated, onCategoryDeleted,
    search, setSearch, pageSizes: CATALOG_PAGE_SIZES,
    page: current?.page ?? query.page ?? 1,
    pageSize: query.pageSize ?? CATALOG_DEFAULT_PAGE_SIZE, setPage, setPageSize,
    response: current,
    items, total: current?.total ?? 0, totalPages: current?.totalPages ?? 0,
    isLoading: catalog.isLoading || catalog.isFetching || isSearchPending,
    error: catalog.isError ? apiErrorMessage(catalog.error, "Не удалось загрузить товары") : null,
    reload: () => { if (!isSearchPending) void catalog.refetch(); },
    selectedProductIds, setProductSelected, selectPage,
    moveSelected, isMoving, moveError, moveResult,
  };
}
