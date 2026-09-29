"use client";

import { Button } from "@/components/button";
import { Dropdown, type DropdownOption } from "@/components/dropdown";
import { Loader } from "@/components/loader";
import { useMoyskladStockImport } from "@/features/products/use-moysklad-stock-import";
import { useGetWarehousesQuery } from "@/features/warehouses/warehouses-api";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MoyskladStockPreviewTable, StockZeroTable } from "./moysklad-stock-preview-table";
import styles from "./style.module.scss";

/**
 * Импорт остатков из отчёта «Остатки» МойСклада.
 *
 * Отчёт строится на один склад, а склада в файле нет — поэтому склад выбирается
 * здесь, до файла, и написан крупно рядом с кнопкой записи: залить файл
 * Костаная в Астану импорт сам не заметит.
 */
export function MoyskladStockImport() {
  const importer = useMoyskladStockImport();
  const { preview, written } = importer;
  const busy = importer.isParsing || importer.isWriting;

  const { data } = useGetWarehousesQuery();
  const options: DropdownOption[] = (data?.items ?? []).map((warehouse) => ({
    value: warehouse.id,
    label: warehouse.code + (warehouse.name === null ? "" : " · " + warehouse.name),
    ...(warehouse.isActive ? {} : { note: "закрыт" }),
  }));

  const warehouseLabel = preview === null
    ? ""
    : preview.warehouse.code + (preview.warehouse.name === null ? "" : " · " + preview.warehouse.name);

  return (
    <section className={styles.block} aria-labelledby="import-moysklad-stock">
      <div className={styles.blockHead}>
        <h2 id="import-moysklad-stock" className={styles.blockTitle}>
          Остатки из МойСклада
        </h2>
      </div>

      <p className={styles.blockHint}>
        Отчёт «Остатки» — один файл на один склад. Выберите склад, потом файл
        в формате .xlsx: старый .xls откройте в Excel и сохраните заново.
        Записываются остаток, резерв, ожидание и себестоимость. Отчёт — это полный
        снимок склада: товар, которого в нём нет, считается проданным, и его
        остаток на этом складе обнулится — список ниже, до записи.
        Срок предзаказа не трогается.
      </p>

      <div className={styles.controls}>
        <div className={styles.field}>
          <span className={styles.label}>Склад</span>
          <Dropdown
            mode="select"
            searchable
            searchPlaceholder="Поиск склада"
            label="Склад"
            placeholder="Выберите склад"
            options={options}
            value={importer.warehouseId}
            onChange={(next) => { void importer.selectWarehouse(next); }}
            disabled={busy || options.length === 0}
          />
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Файл Excel</span>
          <input
            type="file"
            accept=".xlsx"
            className={styles.file}
            // Без склада разбирать нечего: от него зависит список на обнуление.
            disabled={busy || importer.warehouseId === ""}
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
              <span className={styles.metricLabel}>Склад</span>
              <span className={styles.metricValue}>{warehouseLabel}</span>
            </span>

            <span className={styles.metric}>
              <span className={styles.metricLabel}>Отчёт на момент</span>
              <span className={cn(styles.metricValue, preview.stockAt === null && styles.warn)}>
                {preview.stockAt === null ? "не найден — возьмём время записи" : formatDateTime(preview.stockAt)}
              </span>
            </span>

            <span className={styles.metric}>
              <span className={styles.metricLabel}>Товаров в отчёте</span>
              <span className={styles.metricValue}>{preview.total}</span>
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
              <span className={styles.metricLabel}>Не разобрались</span>
              <span className={cn(styles.metricValue, preview.invalid > 0 && styles.warn)}>
                {preview.invalid}
              </span>
            </span>

            <span className={styles.metric}>
              <span className={styles.metricLabel}>Обнулится</span>
              <span className={cn(styles.metricValue, preview.toZero.length > 0 && styles.warn)}>
                {preview.toZero.length}
              </span>
            </span>
          </div>

          {preview.toZero.length > 0 && (
            <>
              <p className={styles.blockHint}>
                Эти товары у нас на складе {warehouseLabel} есть, а в отчёте их нет.
                При записи их остаток, резерв и ожидание станут нулём.
              </p>
              <StockZeroTable items={preview.toZero} />
            </>
          )}

          <MoyskladStockPreviewTable rows={preview.rows} />

          <div className={styles.footer}>
            <Button
              type="button"
              disabled={busy || (preview.ready === 0 && preview.toZero.length === 0)}
              onClick={() => { void importer.write(); }}
            >
              {importer.isWriting
                ? "Записываю…"
                : `Записать в ${warehouseLabel}: ${preview.ready} товаров`
                  + (preview.toZero.length > 0 ? `, обнулить ${preview.toZero.length}` : "")}
            </Button>

            <Button type="button" disabled={busy} onClick={importer.reset}>
              Сбросить
            </Button>

            {written !== null && (
              <span className={styles.done} role="status">
                Записано остатков: {written.updated}
                {`, себестоимость: ${written.costsSet}`}
                {`, обнулено: ${written.zeroed}`}
                {written.failed.length > 0 ? `, пропущено: ${written.failed.length}` : ""}
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
