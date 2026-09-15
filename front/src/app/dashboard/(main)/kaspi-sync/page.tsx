"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/button";
import { useKaspiCatalogSync } from "@/features/kaspi-catalog/use-kaspi-catalog-sync";
import { formatDateTime } from "@/lib/format";
import { usePagination } from "@/lib/use-pagination";
import { CatalogPagination } from "./_components/catalog-pagination";
import { CatalogSummary } from "./_components/catalog-summary";
import { CatalogTable } from "./_components/catalog-table";

export default function KaspiSyncPage() {
  const { files, selectFile, sync, reset, canSync, isLoading, preview, error } =
    useKaspiCatalogSync();

  const [onlyProblems, setOnlyProblems] = useState(false);

  const offers = useMemo(() => {
    if (!preview) return [];

    return onlyProblems
      ? preview.offers.filter((offer) => offer.problems.length > 0)
      : preview.offers;
  }, [preview, onlyProblems]);

  const pagination = usePagination(offers);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Синхронизация с Kaspi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Выгрузки из кабинета продавца: «Действия с файлами» → ACTIVE и ARCHIVE.
          Данные только показываются, в базу пока ничего не сохраняется.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <label className="flex flex-col gap-1 text-sm">
          ACTIVE.xml — в продаже
          <input type="file" accept=".xml" onChange={selectFile("active")} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          ARCHIVE.xml — снятые с продажи
          <input type="file" accept=".xml" onChange={selectFile("archive")} />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={sync} disabled={!canSync}>
            {isLoading ? "Разбираю…" : "Синхронизировать"}
          </Button>

          <Button
            type="button"
            onClick={() => {
              reset();
              setOnlyProblems(false);
              pagination.setPage(1);
            }}
          >
            Сбросить
          </Button>

          {!files.active && !files.archive && (
            <span className="text-sm text-muted-foreground">
              Выберите хотя бы один файл
            </span>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {preview && (
        <>
          <CatalogSummary summary={preview.summary} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyProblems}
                onChange={(event) => {
                  setOnlyProblems(event.target.checked);
                  // Фильтр меняет состав списка — старый номер страницы к нему не относится.
                  pagination.setPage(1);
                }}
              />
              Только с проблемами
            </label>

            <span className="text-sm text-muted-foreground">
              Разобрано {formatDateTime(preview.parsedAt)}
            </span>
          </div>

          <CatalogTable offers={pagination.pageItems} />

          <CatalogPagination pagination={pagination} />

          <div className="flex items-center gap-3 border-t pt-4">
            {/* Товары в базу пока не пишем: сначала глазами проверяем разбор.
                Склады сохраняются отдельно — кнопка в блоке складов выше. */}
            <Button type="button" disabled>
              Сохранить товары в БД
            </Button>
            <span className="text-sm text-muted-foreground">
              Появится после того, как проверим разбор данных
            </span>
          </div>
        </>
      )}
    </div>
  );
}
