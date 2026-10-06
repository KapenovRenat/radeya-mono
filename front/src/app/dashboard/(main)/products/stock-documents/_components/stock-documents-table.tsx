"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import {
  STOCK_DOCUMENT_TYPE_LABELS,
  formatStockDocumentNumber,
  type StockDocumentListItemDto,
} from "@radeya/shared";

import { formatDateTime, formatMoneyExact, moneyToNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DocumentStatus, documentHref, warehouseLabel } from "./document-meta";
import styles from "./stock-documents.module.scss";

/** Подписи колонок списка. Число колонок нужно Tables для пустого состояния. */
const COLUMNS = ["№", "Дата", "Тип", "Склад", "Товаров", "Сумма", "Статус", "Комментарий", "Создал", "Изменён"];

export const STOCK_DOCUMENTS_COLUMN_COUNT = COLUMNS.length;

export function StockDocumentsTableHead() {
  return (
    <tr>
      {COLUMNS.map((title) => <th key={title} scope="col" className={styles.nowrap}>{title}</th>)}
    </tr>
  );
}

/**
 * Строка списка. Открывается кликом в любом месте строки — решение пользователя.
 * Ссылка на номере остаётся: по ней переходят с клавиатуры, и её можно открыть
 * в новой вкладке.
 */
export function StockDocumentRow({ item }: { item: StockDocumentListItemDto }) {
  const router = useRouter();
  const href = documentHref(item.number);

  const open = (event: MouseEvent<HTMLTableRowElement>) => {
    // Клик по самой ссылке она обработает сама — иначе переход случился бы дважды.
    if ((event.target as HTMLElement).closest("a")) return;
    // Выделяли текст комментария мышью — это не переход.
    if (window.getSelection()?.toString()) return;

    if (event.ctrlKey || event.metaKey) window.open(href, "_blank", "noopener");
    else router.push(href);
  };

  return (
    <tr className={cn(styles.row, styles.rowLink)} onClick={open}>
      <td className={styles.number}>
        <Link href={href} className={styles.link}>
          {formatStockDocumentNumber(item.number)}
        </Link>
      </td>
      <td className={styles.nowrap}>{formatDateTime(item.createdAt)}</td>
      <td className={styles.nowrap}>{STOCK_DOCUMENT_TYPE_LABELS[item.type]}</td>
      <td className={styles.nowrap}>{warehouseLabel(item.warehouse)}</td>
      <td className={styles.numeric}>{item.linesCount}</td>
      <td className={styles.numeric}>{formatMoneyExact(moneyToNumber(item.totalAmount) ?? 0)}</td>
      <td><DocumentStatus postedAt={item.postedAt} /></td>
      <td className={styles.comment} title={item.comment ?? undefined}>{item.comment ?? ""}</td>
      <td className={styles.nowrap}>{item.createdBy.name}</td>
      <td className={styles.nowrap}>{formatDateTime(item.updatedAt)}</td>
    </tr>
  );
}
