"use client";

import type { KaspiCatalogSummary } from "@radeya/shared";

import { WarehousesPanel } from "./warehouses-panel";

/** Счётчики над таблицей: сразу видно, что разобралось и что пошло не так. */
export function CatalogSummary({ summary }: { summary: KaspiCatalogSummary }) {
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

      <WarehousesPanel warehouses={summary.warehouses} source="выгрузке" />
    </div>
  );
}
