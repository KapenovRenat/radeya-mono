"use client";

import type { KaspiCatalogSummary } from "@radeya/shared";

import { Button } from "@/components/button";
import { useSaveWarehouses } from "@/features/warehouses/use-save-warehouses";

/** Счётчики над таблицей: сразу видно, что разобралось и что пошло не так. */
export function CatalogSummary({ summary }: { summary: KaspiCatalogSummary }) {
  const { saveWarehouses, isSaving, result, error } = useSaveWarehouses();
  const cards = [
    { label: "Всего", value: summary.total },
    { label: "В продаже", value: summary.onSale },
    { label: "Снято", value: summary.offSale },
    { label: "В наличии", value: summary.inStock },
    { label: "Под заказ", value: summary.preOrder },
    { label: "С проблемами", value: summary.withProblems },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border px-4 py-3">
            <div className="text-xs text-muted-foreground">{card.label}</div>
            <div className="text-xl font-semibold">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border p-4">
        <div className="mb-2 text-sm font-medium">
          Склады в выгрузке: {summary.warehouses.length}
        </div>

        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 font-medium">Код</th>
              <th className="py-1 font-medium">storeId</th>
              <th className="py-1 font-medium">Город (КАТО)</th>
              <th className="py-1 font-medium">Товаров</th>
            </tr>
          </thead>
          <tbody>
            {summary.warehouses.map((warehouse) => (
              <tr key={warehouse.code} className="border-t">
                <td className="py-1 font-medium">{warehouse.code}</td>
                <td className="py-1 text-muted-foreground">{warehouse.storeId}</td>
                <td className="py-1 text-muted-foreground">
                  {warehouse.cityId ?? "—"}
                </td>
                <td className="py-1">{warehouse.offersCount}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Склады сохраняются отдельно от товаров: это справочник, он не ждёт,
            пока мы проверим разбор названий и артикулов. */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3">
          <Button
            type="button"
            onClick={() => saveWarehouses(summary.warehouses)}
            disabled={isSaving || summary.warehouses.length === 0}
          >
            {isSaving ? "Сохраняю…" : "Сохранить склады в БД"}
          </Button>

          {result && (
            <span className="text-sm text-muted-foreground">
              Добавлено {result.created}, обновлено {result.updated}, без
              изменений {result.unchanged}
            </span>
          )}

          {error && <span className="text-sm text-destructive">{error}</span>}

          {!result && !error && (
            <span className="text-sm text-muted-foreground">
              Повторное сохранение безопасно: названия складов, вписанные
              вручную, не перезаписываются
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
