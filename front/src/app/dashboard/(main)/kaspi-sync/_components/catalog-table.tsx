"use client";

import {
  LISTING_STATUSES,
  LISTING_STATUS_LABELS,
  type KaspiCatalogOffer,
} from "@radeya/shared";

const priceFormatter = new Intl.NumberFormat("ru-KZ", {
  style: "currency",
  currency: "KZT",
  maximumFractionDigits: 0,
});

/** Что показать в колонке «Наличие» — остаток или срок предзаказа. */
function stockLabel(offer: KaspiCatalogOffer): string {
  if (offer.totalStock > 0) return `${offer.totalStock} шт`;

  const days = Math.max(...offer.stocks.map((stock) => stock.preOrderDays), 0);

  return days > 0 ? `под заказ, ${days} дн` : "—";
}

export function CatalogTable({ offers }: { offers: KaspiCatalogOffer[] }) {
  if (offers.length === 0) {
    return <p className="text-sm text-muted-foreground">Ничего не найдено</p>;
  }

  return (
    <table className="w-full text-left text-sm">
      <thead className="text-muted-foreground">
        <tr>
          <th className="py-2 font-medium">Фото</th>
          <th className="py-2 font-medium">Товар</th>
          <th className="py-2 font-medium">Артикул</th>
          <th className="py-2 font-medium">Бренд</th>
          <th className="py-2 font-medium">Цена</th>
          <th className="py-2 font-medium">Наличие</th>
          <th className="py-2 font-medium">Склады</th>
          <th className="py-2 font-medium">Статус</th>
        </tr>
      </thead>

      <tbody>
        {offers.map((offer) => (
          <tr key={`${offer.sku}-${offer.status}`} className="border-t align-top">
            {/* Картинок в выгрузке нет — их доберёт парсер кабинета отдельным шагом. */}
            <td className="py-2">
              <div className="flex h-12 w-12 items-center justify-center rounded border text-[10px] text-muted-foreground">
                нет
              </div>
            </td>

            <td className="py-2">
              <div className="font-medium">{offer.name || "—"}</div>
              {offer.subtitle && (
                <div className="text-muted-foreground">{offer.subtitle}</div>
              )}
              {offer.problems.length > 0 && (
                <div className="mt-1 text-destructive">
                  {offer.problems.join("; ")}
                </div>
              )}
            </td>

            <td className="py-2">{offer.sku || "—"}</td>
            <td className="py-2 text-muted-foreground">{offer.brand ?? "—"}</td>

            <td className="py-2 whitespace-nowrap">
              {offer.price === null ? "—" : priceFormatter.format(offer.price)}
            </td>

            <td className="py-2 whitespace-nowrap">{stockLabel(offer)}</td>

            <td className="py-2">
              {offer.stocks.map((stock) => stock.warehouseCode).join(", ") || "—"}
            </td>

            <td className="py-2 whitespace-nowrap">
              <span
                className={
                  offer.status === LISTING_STATUSES.ON_SALE
                    ? ""
                    : "text-muted-foreground"
                }
              >
                {LISTING_STATUS_LABELS[offer.status]}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
