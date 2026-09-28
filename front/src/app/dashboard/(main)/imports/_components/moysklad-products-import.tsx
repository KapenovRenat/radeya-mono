"use client";

import { Button } from "@/components/button";
import { Loader } from "@/components/loader";
import { useMoyskladImport } from "@/features/products/use-moysklad-import";
import { cn } from "@/lib/utils";
import { MoyskladPreviewTable } from "./moysklad-preview-table";
import styles from "./style.module.scss";

/**
 * Импорт закупки, поставщиков и сроков предзаказа из выгрузки МойСклада.
 *
 * Товаров не заводит: каталог наполняется из кабинета Kaspi, здесь только
 * дополняются уже сохранённые артикулы. Об этом сказано прямо в блоке —
 * иначе «товар не найден» у сотни строк выглядит как поломка, а не как
 * устройство импорта.
 */
export function MoyskladProductsImport() {
  const importer = useMoyskladImport();
  const { preview, written } = importer;
  const busy = importer.isParsing || importer.isWriting;

  return (
    <section className={styles.block} aria-labelledby="import-moysklad">
      <div className={styles.blockHead}>
        <h2 id="import-moysklad" className={styles.blockTitle}>
          Товары из МойСклада: закупка, поставщики, предзаказ
        </h2>
      </div>

      <p className={styles.blockHint}>
        Новых товаров не создаёт — дополняет уже сохранённые. Артикул ищется
        по колонке «Код», без учёта регистра. Закупка записывается вместе
        с валютой и к одной не приводится: курса на дату закупки мы не знаем.
        Пустое в файле ничего не затирает, а повторная заливка безопасна —
        импорт обновляет записи, а не создаёт новые.
      </p>

      <div className={styles.controls}>
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

        {importer.sheets.length > 1 && (
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

      {importer.error && <p role="alert" className={styles.error}>{importer.error}</p>}

      {preview !== null && preview.sheet !== null && (
        <>
          <div className={styles.summary}>
            <span className={styles.metric}>
              <span className={styles.metricLabel}>Строк в файле</span>
              <span className={styles.metricValue}>{preview.total}</span>
            </span>

            <span className={styles.metric}>
              <span className={styles.metricLabel}>Не товары</span>
              <span className={styles.metricValue}>{preview.filtered}</span>
            </span>

            <span className={styles.metric}>
              <span className={styles.metricLabel}>Готовы к записи</span>
              <span className={styles.metricValue}>{preview.ready}</span>
            </span>

            <span className={styles.metric}>
              <span className={styles.metricLabel}>Нет в каталоге</span>
              <span className={cn(styles.metricValue, preview.notFound > 0 && styles.warn)}>
                {preview.notFound}
              </span>
            </span>

            <span className={styles.metric}>
              <span className={styles.metricLabel}>Задвоенный код</span>
              <span className={cn(styles.metricValue, preview.duplicated > 0 && styles.warn)}>
                {preview.duplicated}
              </span>
            </span>

            <span className={styles.metric}>
              <span className={styles.metricLabel}>С замечаниями</span>
              <span className={styles.metricValue}>{importer.withProblems}</span>
            </span>
          </div>

          {preview.unknownSuppliers.length > 0 && (
            <div className={styles.unknown}>
              <p className={styles.blockHint}>
                Этих поставщиков нет в справочнике. Закупка и склады у их товаров
                запишутся, а поставщик останется пустым — заведите их и разберите
                файл заново.
              </p>
              <ul className={styles.unknownList}>
                {preview.unknownSuppliers.map((supplier) => (
                  <li key={supplier.name} className={styles.chip}>
                    {supplier.name}
                    <span className={styles.chipCount}>{supplier.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.ignoredColumns.length > 0 && (
            <p className={styles.blockHint}>
              Колонки складов, которые импорт не использует:{" "}
              {preview.ignoredColumns.join(", ")}.
            </p>
          )}

          <MoyskladPreviewTable rows={preview.rows} />

          <div className={styles.footer}>
            <Button
              type="button"
              disabled={busy || preview.ready === 0}
              onClick={() => { void importer.write(); }}
            >
              {importer.isWriting ? "Записываю…" : `Записать ${preview.ready} товаров`}
            </Button>

            <Button type="button" disabled={busy} onClick={importer.reset}>
              Сбросить
            </Button>

            {written !== null && (
              <span className={styles.done} role="status">
                Обновлено артикулов: {written.updated}
                {`, закупка: ${written.pricesSet}`}
                {`, поставщик: ${written.suppliersSet}`}
                {`, строк складов: ${written.stocksSet}`}
                {written.failed.length > 0 ? `, пропущено: ${written.failed.length}` : ""}
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
