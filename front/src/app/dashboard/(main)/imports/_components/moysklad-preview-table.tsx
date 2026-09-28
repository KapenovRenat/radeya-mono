"use client";

import { Fragment } from "react";
import { CURRENCY_LABELS, type MoyskladProductDraft } from "@radeya/shared";

import { formatMoney, moneyToNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import styles from "./style.module.scss";

const COLUMNS = ["Строка", "Код", "Наименование", "Закупка", "Поставщик", "Предзаказ по складам", "В каталоге"];

/** Строка без найденного артикула не записывается — сервер её отсеет. */
function isInvalid(row: MoyskladProductDraft): boolean {
  return row.variantId === null;
}

function text(value: string | null) {
  return value === null ? <span className={styles.muted}>—</span> : value;
}

/**
 * Разобранные строки выгрузки до записи.
 *
 * Показываются все, включая ненайденные в каталоге: человек должен увидеть,
 * что именно не поедет в базу, а не досчитываться этого по разнице счётчиков.
 */
export function MoyskladPreviewTable({ rows }: { rows: MoyskladProductDraft[] }) {
  if (rows.length === 0) return null;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="sr-only">Разобранные строки выгрузки МойСклада</caption>

        <thead>
          <tr>
            {COLUMNS.map((title) => <th key={title} scope="col">{title}</th>)}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <Fragment key={row.row}>
              <tr className={cn(isInvalid(row) && styles.rowInvalid)}>
                <td className={styles.num}>{row.row}</td>
                <td>{text(row.code)}</td>
                <td>{text(row.name)}</td>

                <td className={styles.num}>
                  {row.purchasePrice === null
                    ? <span className={styles.muted}>—</span>
                    : <>
                        {formatMoney(moneyToNumber(row.purchasePrice) ?? 0)
                          .replace("₸", "")
                          .trim()}
                        {" "}
                        {row.currency === null ? "?" : CURRENCY_LABELS[row.currency]}
                      </>}
                </td>

                {/* Поставщик, которого нет в справочнике, показан приглушённо:
                    он разобрался, но в карточку не попадёт. */}
                <td className={cn(row.supplierId === null && styles.muted)}>
                  {text(row.supplierName)}
                </td>

                <td>
                  {row.stocks.length === 0
                    ? <span className={styles.muted}>—</span>
                    : row.stocks
                        .map((stock) => `${stock.warehouseCode}: ${stock.preOrderDays} дн.`)
                        .join(", ")}
                </td>

                <td className={cn(row.variantId === null && styles.muted)}>
                  {row.variantId === null ? "не найден" : row.variantSku}
                </td>
              </tr>

              {row.problems.length > 0 && (
                <tr>
                  {/* Замечания идут отдельной строкой во всю ширину: колонкой
                      они растянули бы таблицу на два экрана вправо. */}
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
