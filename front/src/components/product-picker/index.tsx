"use client";

import { useId, type ReactNode } from "react";

import { Button } from "@/components/button";
import { Checkbox } from "@/components/checkbox";
import { Input } from "@/components/input";
import { Loader } from "@/components/loader";
import { Modal } from "@/components/modal";
import { cn } from "@/lib/utils";
import styles from "./style.module.scss";

export interface ProductPickerItem {
  id: string;
  title: string;
  sku: string;
  imageUrl: string | null;
  /** Справа в строке: остаток, цена — что нужно вызывающему. */
  aside?: ReactNode;
  /** Уже добавлен — отметить нельзя, второй строкой товар не нужен. */
  disabled?: boolean;
}

export interface ProductPickerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  search: string;
  onSearchChange: (value: string) => void;
  items: ProductPickerItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onConfirm: () => void;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

/**
 * Окно выбора товаров: поиск, список с фото и артикулом, отметка галкой,
 * страницы. Выбирают несколько товаров разом.
 *
 * Компонент не знает, откуда товары и куда они уйдут: данные и выбор —
 * у вызывающего (документ склада, позже заказ поставщику). Поэтому
 * и поиск, и страницы управляются снаружи.
 */
export function ProductPicker({ open, onClose, title = "Выбор товаров", search, onSearchChange,
  items, selectedIds, onToggle, page, totalPages, onPageChange, onConfirm,
  isLoading = false, error = null, className }: ProductPickerProps) {
  const searchId = useId();
  const selected = new Set(selectedIds);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      className={cn(styles.picker, className)}
      footer={
        <>
          <span className={styles.selectedCount} aria-live="polite">Выбрано: {selectedIds.length}</span>
          <Button type="button" onClick={onClose} className="">Отмена</Button>
          <Button type="button" onClick={onConfirm} disabled={selectedIds.length === 0} className="">
            Добавить
          </Button>
        </>
      }
    >
      <Input
        id={searchId}
        type="search"
        aria-label="Поиск по названию или артикулу"
        placeholder="Название или артикул"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        autoComplete="off"
        autoFocus
        className={styles.search}
      />

      <div className={styles.list} aria-busy={isLoading}>
        {isLoading ? (
          <div className={styles.status}><Loader /></div>
        ) : error ? (
          <p role="alert" className={styles.status}>{error}</p>
        ) : items.length === 0 ? (
          <p className={styles.status}>Ничего не найдено</p>
        ) : (
          <ul className={styles.items}>
            {items.map((item) => (
              <li key={item.id} className={cn(styles.item, selected.has(item.id) && styles.itemSelected)}>
                <Checkbox
                  checked={selected.has(item.id) || item.disabled === true}
                  disabled={item.disabled}
                  onChange={() => onToggle(item.id)}
                  aria-label={"Выбрать «" + item.title + "», артикул " + item.sku}
                />

                {item.imageUrl ? (
                  // Не next/image: адреса картинок приходят из кабинета Kaspi,
                  // и прописывать каждый домен в next.config.ts нельзя заранее.
                  <img className={styles.image} src={item.imageUrl} alt="" width={48} height={48} loading="lazy" />
                ) : (
                  <span className={styles.noImage}>нет фото</span>
                )}

                <span className={styles.names}>
                  <span className={styles.title}>{item.title}</span>
                  <span className={styles.sku}>{item.sku}{item.disabled && " · уже в документе"}</span>
                </span>

                {item.aside !== undefined && <span className={styles.aside}>{item.aside}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <nav className={styles.pages} aria-label="Страницы списка товаров">
          <button type="button" disabled={isLoading || page <= 1} onClick={() => onPageChange(page - 1)}
            aria-label="Предыдущая страница">‹</button>
          <span>{page} / {totalPages}</span>
          <button type="button" disabled={isLoading || page >= totalPages} onClick={() => onPageChange(page + 1)}
            aria-label="Следующая страница">›</button>
        </nav>
      )}
    </Modal>
  );
}
