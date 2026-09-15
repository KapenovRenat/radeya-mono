"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Постраничный показ списка, который уже целиком лежит в памяти.
 *
 * Для серверной выборки не подходит: там страницу отдаёт запрос, а не срез
 * массива. Здесь случай другой — разбор выгрузки Kaspi приходит одним ответом,
 * а рисовать полторы тысячи строк разом браузеру тяжело.
 */

/** Варианты размера страницы для выпадающего списка. */
export const PAGE_SIZE_OPTIONS = [10, 20, 30] as const;

export const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

/** Разрыв в ряду номеров: 1 … 49 50 51 … 133. */
export const PAGINATION_GAP = "gap" as const;

/** Либо номер страницы, либо разрыв. */
export type PageToken = number | typeof PAGINATION_GAP;

export interface Pagination<T> {
  /** Элементы текущей страницы — их и рисуем. */
  pageItems: T[];
  /** Номер текущей страницы, считая с единицы. */
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  /** Номер первого элемента страницы, считая с единицы. При пустом списке 0. */
  from: number;
  /** Номер последнего элемента страницы. При пустом списке 0. */
  to: number;
  /** Что показать в ряду кнопок: номера и разрывы. */
  pageTokens: PageToken[];
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  goNext: () => void;
  goPrev: () => void;
  canGoNext: boolean;
  canGoPrev: boolean;
}

export function usePagination<T>(
  items: T[],
  initialPageSize: number = DEFAULT_PAGE_SIZE,
): Pagination<T> {
  // Номер и размер страницы меняются вместе (см. changePageSize), поэтому
  // держим их одним состоянием — двумя setState промежуточный кадр показал бы
  // новый размер со старым номером.
  const [state, setState] = useState({ page: 1, pageSize: initialPageSize });

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / state.pageSize));

  // Список мог укоротиться под фильтром — тогда сохранённый номер выходит за
  // границы. Поджимаем при рендере, а не эффектом: эффект отрисовал бы один
  // кадр с пустой страницей.
  const page = Math.min(state.page, totalPages);

  const start = (page - 1) * state.pageSize;
  const end = Math.min(start + state.pageSize, totalItems);

  const pageItems = useMemo(
    () => items.slice(start, end),
    [items, start, end],
  );

  const setPage = useCallback((next: number) => {
    setState((current) => ({ ...current, page: Math.max(1, next) }));
  }, []);

  const setPageSize = useCallback((size: number) => {
    setState((current) => {
      // Держимся за первый элемент текущей страницы: сменив размер, человек
      // хочет видеть больше того же места, а не прыгнуть в начало списка.
      const firstIndex = (current.page - 1) * current.pageSize;

      return { pageSize: size, page: Math.floor(firstIndex / size) + 1 };
    });
  }, []);

  const goNext = useCallback(() => {
    setState((current) => ({ ...current, page: current.page + 1 }));
  }, []);

  const goPrev = useCallback(() => {
    setState((current) => ({ ...current, page: Math.max(1, current.page - 1) }));
  }, []);

  const pageTokens = useMemo(
    () => buildPageTokens(page, totalPages),
    [page, totalPages],
  );

  return {
    pageItems,
    page,
    pageSize: state.pageSize,
    totalPages,
    totalItems,
    from: totalItems === 0 ? 0 : start + 1,
    to: end,
    pageTokens,
    setPage,
    setPageSize,
    goNext,
    goPrev,
    canGoNext: page < totalPages,
    canGoPrev: page > 1,
  };
}

/** Сколько соседей показываем слева и справа от текущей страницы. */
const SIBLINGS = 1;

/**
 * Ряд номеров с разрывами. При 133 страницах рисовать 133 кнопки нельзя,
 * поэтому показываем первую, последнюю и окно вокруг текущей.
 *
 * У краёв окно упирается в границу и сдвигается внутрь, чтобы количество
 * кнопок не скакало при переходе между страницами.
 */
function buildPageTokens(page: number, totalPages: number): PageToken[] {
  const windowSize = SIBLINGS * 2 + 1;
  // Первая и последняя страницы, окно и два разрыва.
  const maxTokens = windowSize + 4;

  if (totalPages <= maxTokens) {
    return range(1, totalPages);
  }

  let left = Math.max(2, page - SIBLINGS);
  let right = Math.min(totalPages - 1, page + SIBLINGS);

  if (right - left + 1 < windowSize) {
    if (page <= totalPages / 2) {
      right = Math.min(totalPages - 1, left + windowSize - 1);
    } else {
      left = Math.max(2, right - windowSize + 1);
    }
  }

  return [
    1,
    ...(left > 2 ? [PAGINATION_GAP as PageToken] : []),
    ...range(left, right),
    ...(right < totalPages - 1 ? [PAGINATION_GAP as PageToken] : []),
    totalPages,
  ];
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}
