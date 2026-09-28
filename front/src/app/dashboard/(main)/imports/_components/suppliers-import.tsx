"use client";

import { SUPPLIER_IMPORT_GROUP } from "@radeya/shared";

import { Button } from "@/components/button";
import { Loader } from "@/components/loader";
import { useGetSuppliersQuery } from "@/features/suppliers/suppliers-api";
import { useSupplierImport } from "@/features/suppliers/use-supplier-import";
import { cn } from "@/lib/utils";
import { SupplierPreviewTable } from "./supplier-preview-table";
import styles from "./style.module.scss";

/**
 * Импорт поставщиков из выгрузки контрагентов МойСклада.
 *
 * Блок независим от импорта продаж: свой файл, свой предпросмотр, своя запись.
 * Повторная заливка того же файла дублей не создаёт — сверка идёт по UUID
 * контрагента, и об этом сказано прямо в интерфейсе: иначе человек будет
 * бояться нажать кнопку второй раз.
 */
export function SuppliersImport() {
  const suppliers = useGetSuppliersQuery();
  const importer = useSupplierImport();
  const { preview, written } = importer;
  const busy = importer.isParsing || importer.isWriting;

  return (
    <section className={styles.block} aria-labelledby="import-suppliers">
      <div className={styles.blockHead}>
        <h2 id="import-suppliers" className={styles.blockTitle}>
          Поставщики из МойСклада
        </h2>
        <p className={styles.blockHint}>
          В базе поставщиков: {suppliers.data?.items.length ?? "…"}
        </p>
      </div>

      <p className={styles.blockHint}>
        Выгрузка контрагентов целиком. Поставщиками считаются только строки
        группы «{SUPPLIER_IMPORT_GROUP}» — покупатели и банки отбрасываются.
        Сверка идёт по UUID контрагента, поэтому повторная заливка того же файла
        дублей не создаёт. Telegram ID выгрузка не содержит: проставляется руками.
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
              <span className={styles.metricLabel}>Не поставщики</span>
              <span className={styles.metricValue}>{preview.filtered}</span>
            </span>

            <span className={styles.metric}>
              <span className={styles.metricLabel}>Поставщиков в файле</span>
              <span className={styles.metricValue}>{preview.rows.length}</span>
            </span>

            <span className={styles.metric}>
              <span className={styles.metricLabel}>Новых</span>
              <span className={styles.metricValue}>{importer.fresh}</span>
            </span>

            <span className={styles.metric}>
              <span className={styles.metricLabel}>Уже в базе</span>
              <span className={styles.metricValue}>{preview.known}</span>
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
          </div>

          {preview.rows.length === 0 && (
            <p className={styles.blockHint}>
              На листе нет ни одного контрагента из группы «{SUPPLIER_IMPORT_GROUP}».
              Проставьте группу в МойСкладе нужным контрагентам и выгрузите файл заново.
            </p>
          )}

          {importer.withDiffs > 0 && (
            <p className={styles.blockHint}>
              Расхождений с нашими данными: {importer.withDiffs}. Заполненные поля
              импорт не перезаписывает — правки, сделанные руками, останутся.
              Что именно разошлось, видно под строкой.
            </p>
          )}

          <SupplierPreviewTable rows={preview.rows} />

          <div className={styles.footer}>
            <Button
              type="button"
              disabled={busy || importer.ready === 0}
              onClick={() => { void importer.write(); }}
            >
              {/* В счёт записи входят и уже известные строки: у них дозаполнятся
                  пустые поля. Написать просто «записать N» значило бы обещать
                  N новых поставщиков, а их будет меньше. */}
              {importer.isWriting
                ? "Записываю…"
                : `Записать: ${importer.fresh} новых, ${preview.known} уже есть`}
            </Button>

            <Button type="button" disabled={busy} onClick={importer.reset}>
              Сбросить
            </Button>

            {written !== null && (
              <span className={styles.done} role="status">
                Заведено новых: {written.created}
                {written.updated > 0 ? `, дополнено: ${written.updated}` : ""}
                {written.skipped > 0 ? `, без изменений: ${written.skipped}` : ""}
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
