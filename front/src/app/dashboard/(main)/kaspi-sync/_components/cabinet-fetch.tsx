"use client";

import { Button } from "@/components/button";
import { useCabinetFilters } from "@/features/kaspi-catalog/use-cabinet-filters";
import { useKaspiCabinet } from "@/features/kaspi-catalog/use-kaspi-cabinet";
import { useImportKaspiProducts } from "@/features/products/use-import-kaspi-products";
import { usePagination } from "@/lib/use-pagination";
import { CabinetTable } from "./cabinet-table";
import { CatalogPagination } from "./catalog-pagination";
import { ProductsImportPanel } from "./products-import-panel";
import { WarehousesPanel } from "./warehouses-panel";

/**
 * Загрузка каталога напрямую из кабинета Kaspi.
 *
 * Результат пока уходит в консоль сервера — смотрим глазами, что пришло.
 * В базу не пишется ничего.
 */
export function CabinetFetch() {
  const {
    cookie,
    setCookie,
    remember,
    setRemember,
    load,
    isLoading,
    result,
    error,
  } = useKaspiCabinet();

  const productsImport = useImportKaspiProducts(result?.offers ?? []);

  // В таблицу идут только новые товары: на второй синхронизации из полутора
  // тысяч строк интересны те несколько, которых в каталоге ещё нет.
  const {
    query,
    setQuery,
    showOffSale,
    setShowOffSale,
    onlyProblems,
    setOnlyProblems,
    filtered,
  } = useCabinetFilters(productsImport.newOffers);

  const pagination = usePagination(filtered);

  /** Любой фильтр меняет состав списка — старый номер страницы к нему не относится. */
  const resetPage = () => pagination.setPage(1);

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div>
        <div className="text-sm font-medium">Загрузка из кабинета</div>
        <p className="mt-1 text-sm text-muted-foreground">
          DevTools → Network → запрос <code>list</code> → Headers → Request
          Headers → скопировать значение <code>Cookie</code> целиком.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Кука сессии кабинета
        <input
          type="password"
          className="rounded border bg-transparent px-2 py-1 font-mono"
          value={cookie}
          onChange={(event) => setCookie(event.target.value)}
          placeholder={
            result?.hasStoredCookie
              ? "Кука запомнена — поле можно оставить пустым"
              : "Вставьте значение заголовка Cookie"
          }
          autoComplete="off"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        />
        Запомнить до перезапуска сервера
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={load} disabled={isLoading}>
          {isLoading ? "Загружаю…" : "Загрузить все товары"}
        </Button>

        <span className="text-sm text-muted-foreground">
          В продаже и снятые с продажи, в базу не пишется
        </span>
      </div>

      {result && (
        <div className="text-sm">
          <div>
            Получено {result.total}: в продаже {result.onSale}, снято{" "}
            {result.offSale}. Страниц {result.pages}
            {result.withProblems > 0 && `, с проблемами ${result.withProblems}`}
          </div>

          {result.expected !== null && result.expected !== result.total && (
            <div className="text-destructive">
              Кабинет обещал {result.expected} товаров — часть не получена
            </div>
          )}

          {result.stoppedAtPage !== null && (
            <div className="text-destructive">
              Прервано на странице {result.stoppedAtPage}: {result.stoppedReason}.
              Вставьте свежую куку и повторите.
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && result.warehouses.length > 0 && (
        <WarehousesPanel warehouses={result.warehouses} source="кабинете" />
      )}

      {result && result.offers.length > 0 && (
        <ProductsImportPanel
          newCount={productsImport.newOffers.length}
          knownCount={productsImport.knownCount}
          isChecking={productsImport.isChecking}
          onSave={productsImport.save}
          isSaving={productsImport.isSaving}
          savedCount={productsImport.savedCount}
          result={productsImport.result}
          error={productsImport.error}
        />
      )}

      {result && productsImport.newOffers.length > 0 && (
        <div className="space-y-3 border-t pt-3">
          <div className="flex flex-wrap items-center gap-4">
            <input
              type="search"
              className="min-w-64 flex-1 rounded border bg-transparent px-2 py-1 text-sm"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                resetPage();
              }}
              placeholder="Поиск по названию или артикулу"
            />

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showOffSale}
                onChange={(event) => {
                  setShowOffSale(event.target.checked);
                  resetPage();
                }}
              />
              Снятые с продажи
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyProblems}
                onChange={(event) => {
                  setOnlyProblems(event.target.checked);
                  resetPage();
                }}
              />
              Только с проблемами
            </label>

            <span className="text-sm text-muted-foreground">
              Найдено {filtered.length}
            </span>
          </div>

          <CabinetTable offers={pagination.pageItems} />

          <CatalogPagination pagination={pagination} />
        </div>
      )}
    </div>
  );
}
