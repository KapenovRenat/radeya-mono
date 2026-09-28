"use client";

import { Fragment } from "react";
import type { SupplierDiff, SupplierDraft } from "@radeya/shared";

import { cn } from "@/lib/utils";
import styles from "./style.module.scss";

const COLUMNS = ["Строка", "Наименование", "Фактический адрес", "Телефон", "В базе"];

const DIFF_FIELD_LABELS: Record<SupplierDiff["field"], string> = {
  name: "Наименование",
  address: "Адрес",
  phone: "Телефон",
};

/** Без наименования или UUID строка не записывается — сервер её отсеет. */
function isInvalid(row: SupplierDraft): boolean {
  return row.name === null || row.externalId === null;
}

function text(value: string | null) {
  return value === null ? <span className={styles.muted}>—</span> : value;
}

/**
 * Разобранные строки выгрузки до записи.
 *
 * Показываются все строки группы поставщиков, включая те, что уже есть в базе:
 * человек должен видеть, что повторный импорт их не задублит, а не досчитываться
 * этого по разнице счётчиков.
 */
export function SupplierPreviewTable({ rows }: { rows: SupplierDraft[] }) {
  if (rows.length === 0) return null;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="sr-only">Разобранные строки выгрузки контрагентов</caption>

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
                <td>{text(row.name)}</td>
                <td>{text(row.address)}</td>
                <td>{text(row.phone)}</td>

                <td className={cn(!row.known && styles.muted)}>
                  {row.known ? "уже есть" : "новый"}
                </td>
              </tr>

              {row.diffs.length > 0 && (
                <tr>
                  {/* Расхождения и замечания идут отдельной строкой во всю
                      ширину: колонками они растянули бы таблицу вправо. */}
                  <td />
                  <td colSpan={COLUMNS.length - 1}>
                    <ul className={cn(styles.problems, styles.muted)}>
                      {row.diffs.map((diff) => (
                        <li key={diff.field}>
                          {DIFF_FIELD_LABELS[diff.field]}: у нас «{diff.ours}», в файле «{diff.file}»
                          {" — оставим наше"}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              )}

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
