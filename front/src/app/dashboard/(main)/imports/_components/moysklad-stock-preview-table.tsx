"use client";

import { Fragment } from "react";
import type { StockReportRow, StockZeroCandidate } from "@radeya/shared";

import { formatMoney, moneyToNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import styles from "./style.module.scss";

const COLUMNS = [
  "Строка", "Код", "Наименование", "Остаток", "Резерв", "Ожидание",
  "Себестоимость", "Дней на складе", "В каталоге",
];

/** Строка, которую сервер не запишет: нет в каталоге, задвоена или не разобралась. */
function isSkipped(row: StockReportRow): boolean {
  return row.variantId === null || row.duplicate || row.invalid;
}

function muted(value: string) {
  return <span className={styles.muted}>{value}</span>;
}

/**
 * Разобранные строки отчёта до записи. Показываются все, включая пропущенные:
 * человек должен видеть, что именно не поедет в базу.
 */
export function MoyskladStockPreviewTable({ rows }: { rows: StockReportRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="sr-only">Разобранные строки отчёта остатков</caption>

        <thead>
          <tr>
            {COLUMNS.map((title) => <th key={title} scope="col">{title}</th>)}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <Fragment key={row.row}>
              <tr className={cn(isSkipped(row) && styles.rowInvalid)}>
                <td className={styles.num}>{row.row}</td>
                <td>{row.code ?? muted("—")}</td>
                <td>{row.name ?? muted("—")}</td>
                {/* Отрицательное не подкрашиваем в ошибку: это правда учёта —
                    продали то, что не посадили. */}
                <td className={styles.num}>{row.quantity}</td>
                <td className={styles.num}>{row.reserved}</td>
                <td className={styles.num}>{row.expected}</td>
                <td className={styles.num}>
                  {row.costPrice === null
                    ? muted("—")
                    : formatMoney(moneyToNumber(row.costPrice) ?? 0)}
                </td>
                <td className={styles.num}>{row.daysOnStock ?? muted("—")}</td>
                <td className={cn(row.variantId === null && styles.muted)}>
                  {row.variantId === null ? "не найден" : row.variantSku}
                </td>
              </tr>

              {row.problems.length > 0 && (
                <tr>
                  <td />
                  <td colSpan={COLUMNS.length - 1}>
                    <ul className={styles.problems}>
                      {row.problems.map((problem, index) => (
                        <li key={index}>
                          {problem.column === null ? "" : problem.column + ": "}
                          {problem.message}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Что обнулится при записи: у нас на складе есть, в отчёте нет. */
export function StockZeroTable({ items }: { items: StockZeroCandidate[] }) {
  if (items.length === 0) return null;

  const value = (count: number | null) => count ?? muted("—");

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="sr-only">Товары, чей остаток обнулится</caption>

        <thead>
          <tr>
            {["Артикул", "Товар", "Остаток сейчас", "Резерв", "Ожидание"].map((title) => (
              <th key={title} scope="col">{title}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr key={item.variantId}>
              <td>{item.sku}</td>
              <td>{item.name}</td>
              <td className={styles.num}>{value(item.quantity)}</td>
              <td className={styles.num}>{value(item.reserved)}</td>
              <td className={styles.num}>{value(item.expected)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
