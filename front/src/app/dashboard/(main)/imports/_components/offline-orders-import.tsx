"use client";

import { DICTIONARY_KIND_LABELS, SALES_POINT_TYPES,
  type DictionaryKind } from "@radeya/shared";

import { Button } from "@/components/button";
import { Loader } from "@/components/loader";
import { useOfflineImport } from "@/features/imports/use-offline-import";
import { useGetSalesPointsQuery } from "@/features/sales-points/sales-points-api";
import { cn } from "@/lib/utils";
import { ImportPreviewTable } from "./import-preview-table";
import styles from "./style.module.scss";

/**
 * Импорт продаж офлайн-точки из книги Excel.
 *
 * Порядок шагов задан самим интерфейсом: пока не выбран файл, нечего выбирать
 * из листов; пока не разобран лист, нечего записывать. Кнопка записи выключена
 * до последнего — это единственное необратимое действие на странице.
 */
export function OfflineOrdersImport() {
  const points = useGetSalesPointsQuery();
  const offline = (points.data?.items ?? []).filter(
    (point) => point.type === SALES_POINT_TYPES.OFFLINE && point.isActive,
  );

  const importer = useOfflineImport();
  const { preview, written } = importer;
  const busy = importer.isParsing || importer.isWriting;

  return (
    <section className={styles.block} aria-labelledby="import-offline">
      <div className={styles.blockHead}>
        <h2 id="import-offline" className={styles.blockTitle}>
          Excel продаж офлайн-точки
        </h2>
        <p className={styles.blockHint}>
          Файл разбирается и показывается целиком. В базу ничего не попадёт,
          пока вы не нажмёте «Записать».
        </p>
      </div>

      <div className={styles.controls}>
        <label className={styles.field}>
          <span className={styles.label}>Точка продаж</span>
          <select
            className={styles.select}
            value={importer.salesPointId}
            disabled={busy || offline.length === 0}
            onChange={(event) => importer.setSalesPointId(event.target.value)}
          >
            <option value="">Выберите точку</option>
            {offline.map((point) => (
              <option key={point.id} value={point.id}>{point.name}</option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Файл Excel</span>
          <input
            type="file"
            accept=".xlsx"
            className={styles.file}
            disabled={busy}
            onChange={(event) => {
              void importer.selectFile(event.target.files?.[0] ?? null);
            }}
          />
        </label>

        {importer.sheets.length > 0 && (
          <label className={styles.field}>
            <span className={styles.label}>Лист книги</span>
            <select
              className={styles.select}
              value={preview?.sheet ?? ""}
              disabled={busy}
              onChange={(event) => { void importer.selectSheet(event.target.value); }}
            >
              <option value="">Выберите лист</option>
              {importer.sheets.map((sheet) => (
                <option key={sheet} value={sheet}>{sheet}</option>
              ))}
            </select>
          </label>
        )}

        {busy && <Loader size={28} hideLabel />}
      </div>

      {offline.length === 0 && !points.isLoading && (
        <p className={styles.blockHint}>
          Офлайн-точек пока нет. Заведите точку продаж на странице «Статистика».
        </p>
      )}

      {importer.error && <p role="alert" className={styles.error}>{importer.error}</p>}

      {preview?.sheet !== null && preview !== null && (
        <>
          <div className={styles.summary}>
            <span className={styles.metric}>
              <span className={styles.metricLabel}>Разобрано строк</span>
              <span className={styles.metricValue}>{preview.rows.length}</span>
            </span>

            <span className={styles.metric}>
              <span className={styles.metricLabel}>Готовы к записи</span>
              <span className={styles.metricValue}>{importer.ready}</span>
            </span>

            <span className={styles.metric}>
              <span className={styles.metricLabel}>Не записать</span>
              <span className={cn(styles.metricValue, preview.invalid > 0 && styles.warn)}>
                {preview.invalid}
              </span>
            </span>

            <span className={styles.metric}>
              <span className={styles.metricLabel}>С замечаниями</span>
              <span className={styles.metricValue}>{importer.withProblems}</span>
            </span>

            <span className={styles.metric}>
              <span className={styles.metricLabel}>Пропущено пустых</span>
              <span className={styles.metricValue}>{preview.skipped}</span>
            </span>
          </div>

          {preview.unknownValues.length > 0 && (
            <div className={styles.unknown}>
              <p className={styles.blockHint}>
                Этих значений нет в справочниках. Строки всё равно запишутся,
                но поле останется пустым — добавьте значение и разберите лист заново.
              </p>
              <ul className={styles.unknownList}>
                {preview.unknownValues.map((value) => (
                  <li key={value.kind + value.value} className={styles.chip}>
                    {DICTIONARY_KIND_LABELS[value.kind as DictionaryKind] ?? value.kind}
                    {": "}
                    {value.value}
                    <span className={styles.chipCount}>{value.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.ignoredColumns.length > 0 && (
            <p className={styles.blockHint}>
              Колонки файла, которые импорт не использует:{" "}
              {preview.ignoredColumns.join(", ")}.
            </p>
          )}

          <ImportPreviewTable rows={preview.rows} />

          <div className={styles.footer}>
            <Button
              type="button"
              disabled={busy || importer.ready === 0 || importer.salesPointId === ""}
              onClick={() => { void importer.write(); }}
            >
              {importer.isWriting ? "Записываю…" : `Записать ${importer.ready} заказов`}
            </Button>

            <Button type="button" disabled={busy} onClick={importer.reset}>
              Сбросить
            </Button>

            {written !== null && (
              <span className={styles.done} role="status">
                Записано заказов: {written.created}
                {written.failed.length > 0
                  ? `, пропущено строк: ${written.failed.length}`
                  : ""}
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
