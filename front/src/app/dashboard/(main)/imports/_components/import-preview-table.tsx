"use client";

import { Fragment } from "react";
import type { OfflineOrderDraft } from "@radeya/shared";

import { formatDateTime, formatMoney, moneyToNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import styles from "./style.module.scss";

const COLUMNS = [
  "Строка", "Дата", "Товар", "Сумма", "Оплачено", "Остаток",
  "Скидка", "Оплата", "Откуда товар", "Статус доставки", "Рабочий день",
];

/** Строка без даты или суммы записана не будет — сервер её отсеет. */
function isInvalid(row: OfflineOrderDraft): boolean {
  return row.placedAt === null || row.totalPrice === null;
}

function money(value: string | null) {
  const amount = moneyToNumber(value);

  return amount === null ? <span className={styles.muted}>—</span> : formatMoney(amount);
}

function text(value: string | null) {
  return value === null ? <span className={styles.muted}>—</span> : value;
}

/**
 * Разобранные строки файла до записи.
 *
 * Показываются все, включая непригодные: человек должен увидеть, что именно
 * не поедет в базу, а не досчитываться этого по разнице счётчиков.
 */
export function ImportPreviewTable({ rows }: { rows: OfflineOrderDraft[] }) {
  if (rows.length === 0) return null;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="sr-only">Разобранные строки файла</caption>

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

                <td>
                  {row.placedAt === null
                    ? <span className={styles.muted}>нет даты</span>
                    : formatDateTime(row.placedAt)}
                </td>

                <td>
                  {text(row.productName)}
                  {row.productNote !== null && (
                    <span className={cn(styles.muted, "ml-2")}>{row.productNote}</span>
                  )}
                </td>

                <td className={styles.num}>{money(row.totalPrice)}</td>
                <td className={styles.num}>{money(row.paidAmount)}</td>
                <td className={styles.num}>{money(row.balanceDue)}</td>

                <td>
                  {row.discountPercent === null
                    ? text(row.discountComment)
                    : row.discountPercent + "%"}
                </td>

                {/* Значение, которого нет в справочнике, показываем приглушённо:
                    оно разобралось, но в заказ не попадёт, пока не добавят. */}
                <td className={cn(row.paymentMethodId === null && styles.muted)}>
                  {text(row.paymentMethodText)}
                </td>
                <td className={cn(row.shipmentOriginId === null && styles.muted)}>
                  {text(row.shipmentOriginText)}
                </td>
                <td className={cn(row.deliveryStatusId === null && styles.muted)}>
                  {text(row.deliveryStatusText)}
                </td>

                <td>{text(row.sellerHint)}</td>
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
