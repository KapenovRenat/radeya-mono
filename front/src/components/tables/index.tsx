"use client";

import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { CATALOG_PAGE_SIZES, type CatalogPageSize } from "@radeya/shared";
import { Loader } from "@/components/loader";
import { cn } from "@/lib/utils";
import styles from "./style.module.scss";

export interface TablesProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** Строки <tr> с ячейками <td>; компонент помещает их внутрь tbody. */
  children?: ReactNode;
  /** Строки заголовка <tr> с ячейками <th>. */
  head?: ReactNode;
  columnCount?: number;
  caption?: string;
  page: number;
  pageSize: CatalogPageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: CatalogPageSize) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyLabel?: string;
}

/** Управляемая серверная таблица: children уже содержат выбранную страницу. */
export function Tables({ children, head, columnCount = 1, caption = "Таблица товаров",
  page, pageSize, total, onPageChange, onPageSizeChange, isLoading = false,
  error, onRetry, emptyLabel = "Товары не найдены", className, ...props }: TablesProps) {
  const sizeId = useId();
  const totalPages = Math.ceil(total / pageSize);
  const currentPage = Math.min(Math.max(1, page), Math.max(1, totalPages));
  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, total);
  const disabled = isLoading || Boolean(error);
  const status = isLoading ? <Loader /> : error ? (
    <div role="alert">{error} {onRetry && <button type="button" onClick={onRetry}>Повторить</button>}</div>
  ) : total === 0 ? emptyLabel : null;

  return (
    <div {...props} className={cn(styles.tables, className)}>
      <div className={styles.scroll} role="region" aria-label={caption} tabIndex={0}>

        <table className={styles.table} aria-label={caption} aria-busy={isLoading}>
          {head && <thead>{head}</thead>}
          <tbody>
            {status !== null ? <tr><td colSpan={columnCount} className={styles.status}>{status}</td></tr>
              : children ?? <tr><td colSpan={columnCount} className={styles.status}>Данные получены. Добавьте строки таблицы через children.</td></tr>}
          </tbody>
        </table>

      </div>

      <div className={styles.pagination}>

        <label className={styles.pageSize} htmlFor={sizeId}>
          Показывать
          <select id={sizeId} value={pageSize} disabled={isLoading} onChange={(event) => {
            const size = CATALOG_PAGE_SIZES.find((value) => value === Number(event.target.value));
            if (size !== undefined) onPageSizeChange(size);
          }}>
            {CATALOG_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>

        <span className={styles.summary} aria-live="polite">
          {isLoading ? "Загрузка…" : error ? "Не удалось загрузить данные" : from + "–" + to + " из " + total}
        </span>

        <nav className={styles.controls} aria-label="Страницы таблицы">
          <button type="button" disabled={disabled || currentPage <= 1} onClick={() => onPageChange(1)} aria-label="Первая страница">«</button>
          <button type="button" disabled={disabled || currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} aria-label="Предыдущая страница">‹</button>
          <span>{isLoading || error ? "—" : (totalPages === 0 ? 0 : currentPage) + " / " + totalPages}</span>
          <button type="button" disabled={disabled || currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} aria-label="Следующая страница">›</button>
          <button type="button" disabled={disabled || currentPage >= totalPages} onClick={() => onPageChange(totalPages)} aria-label="Последняя страница">»</button>
        </nav>
      </div>
    </div>
  );
}
