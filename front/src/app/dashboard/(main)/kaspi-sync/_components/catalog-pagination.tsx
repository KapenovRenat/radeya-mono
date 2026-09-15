"use client";

import type { ReactNode } from "react";

import {
  PAGE_SIZE_OPTIONS,
  PAGINATION_GAP,
  type Pagination,
} from "@/lib/use-pagination";
import { cn } from "@/lib/utils";

/**
 * Панель пагинации под таблицей: размер страницы, диапазон и номера.
 *
 * Про содержимое списка не знает — берёт только счётчики из usePagination,
 * поэтому подойдёт любой таблице раздела.
 */
export function CatalogPagination({
  pagination,
}: {
  pagination: Pagination<unknown>;
}) {
  const {
    page,
    pageSize,
    totalPages,
    totalItems,
    from,
    to,
    pageTokens,
    setPage,
    setPageSize,
    goNext,
    goPrev,
    canGoNext,
    canGoPrev,
  } = pagination;

  if (totalItems === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
      <label className="flex items-center gap-2">
        <span className="text-muted-foreground">Строк на странице</span>
        <select
          className="rounded border bg-transparent px-2 py-1"
          value={pageSize}
          onChange={(event) => setPageSize(Number(event.target.value))}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>

      <span className="text-muted-foreground">
        Показано {from}–{to} из {totalItems}
      </span>

      <div className="flex items-center gap-1">
        <PageButton onClick={goPrev} disabled={!canGoPrev} label="Назад">
          ‹
        </PageButton>

        {pageTokens.map((token, index) =>
          token === PAGINATION_GAP ? (
            // Разрывов максимум два и местами они не меняются — индекс в ключе безопасен.
            <span key={`gap-${index}`} className="px-2 text-muted-foreground">
              …
            </span>
          ) : (
            <PageButton
              key={token}
              onClick={() => setPage(token)}
              active={token === page}
              label={`Страница ${token}`}
            >
              {token}
            </PageButton>
          ),
        )}

        <PageButton onClick={goNext} disabled={!canGoNext} label="Вперёд">
          ›
        </PageButton>
      </div>

      <span className="text-muted-foreground">
        Страница {page} из {totalPages}
      </span>
    </div>
  );
}

function PageButton({
  children,
  onClick,
  disabled,
  active,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "min-w-8 rounded border px-2 py-1 disabled:opacity-40",
        active && "font-semibold",
      )}
    >
      {children}
    </button>
  );
}
