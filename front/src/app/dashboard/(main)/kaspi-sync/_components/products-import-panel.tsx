"use client";

import type { ImportKaspiProductsResponse } from "@radeya/shared";

import { Button } from "@/components/button";

interface ProductsImportPanelProps {
  /** Сколько товаров из загруженных ещё нет в каталоге. */
  newCount: number;
  /** Сколько уже лежит в базе — их не показываем и не перезаписываем. */
  knownCount: number;
  /** Список артикулов ещё едет: до него «новых нет» — неправда. */
  isChecking: boolean;
  onSave: () => void;
  isSaving: boolean;
  /** Сколько товаров уже сохранено: список уходит пачками, это может быть долго. */
  savedCount: number;
  result: ImportKaspiProductsResponse | null;
  error: string | null;
}

/**
 * Сохранение загруженных товаров в каталог.
 *
 * Кнопка живёт здесь, а не рядом с загрузкой: сначала человек смотрит таблицу,
 * и только потом решает писать в базу. Синхронизация сама в базу не пишет.
 */
export function ProductsImportPanel({
  newCount,
  knownCount,
  isChecking,
  onSave,
  isSaving,
  savedCount,
  result,
  error,
}: ProductsImportPanelProps) {
  if (isChecking) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        Сверяю с каталогом…
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 text-sm font-medium">
        {newCount > 0
          ? `Новых товаров: ${newCount}`
          : "Новых товаров на Kaspi не создано"}
      </div>

      <p className="text-sm text-muted-foreground">
        {knownCount > 0 &&
          `Уже в каталоге: ${knownCount} — они не показаны и не будут перезаписаны. `}
        Сохранение заводит только новые артикулы: категория, ткань, закупочная
        цена и цена сайта у существующих товаров остаются нетронутыми.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3">
        <Button
          type="button"
          onClick={onSave}
          disabled={isSaving || newCount === 0}
        >
          {isSaving
            ? `Сохраняю… ${savedCount} из ${newCount}`
            : "Сохранить товары в БД"}
        </Button>

        {result && (
          <span className="text-sm text-muted-foreground">
            Добавлено {result.created}, пропущено {result.skipped}
            {result.failed.length > 0 && `, с ошибкой ${result.failed.length}`}
          </span>
        )}

        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>

      {result && result.missingWarehouses.length > 0 && (
        <p className="mt-3 text-sm text-destructive">
          Складов нет в справочнике: {result.missingWarehouses.join(", ")}.
          Остатки по ним не записаны — сохраните склады и повторите загрузку.
        </p>
      )}

      {result && result.failed.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-destructive">
          {result.failed.map((failure) => (
            <li key={failure.sku}>
              {failure.sku} — {failure.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
