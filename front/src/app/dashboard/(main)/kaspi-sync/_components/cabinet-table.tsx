"use client";

import {
  LISTING_STATUSES,
  LISTING_STATUS_LABELS,
  type CabinetOffer,
} from "@radeya/shared";

const priceFormatter = new Intl.NumberFormat("ru-KZ", {
  style: "currency",
  currency: "KZT",
  maximumFractionDigits: 0,
});

/** «Не указаны» в кабинете означает предзаказ, а не ноль на складе. */
function stockLabel(offer: CabinetOffer): string {
  if (offer.totalStock > 0) return `${offer.totalStock} шт`;

  return offer.preOrderDays > 0 ? `под заказ, ${offer.preOrderDays} дн` : "—";
}

export function CabinetTable({ offers }: { offers: CabinetOffer[] }) {
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
          <th className="py-2 font-medium">Штрихкод</th>
          <th className="py-2 font-medium">Цена</th>
          <th className="py-2 font-medium">Наличие</th>
          <th className="py-2 font-medium">Склады</th>
          <th className="py-2 font-medium">Размер</th>
          <th className="py-2 font-medium">Статус</th>
        </tr>
      </thead>

      <tbody>
        {offers.map((offer) => (
          <tr key={offer.offerId ?? offer.sku} className="border-t align-top">
            <td className="py-2">
              {offer.imageUrl ? (
                // Обычный img, а не next/image: адреса на чужом CDN, и заводить
                // ради предпросмотра разрешённый домен в конфиге незачем.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={offer.imageUrl}
                  alt=""
                  className="h-12 w-12 rounded border object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded border text-[10px] text-muted-foreground">
                  нет
                </div>
              )}
            </td>

            <td className="py-2">
              <div className="font-medium">{offer.masterTitle ?? offer.title}</div>

              {offer.masterTitle && offer.title !== offer.masterTitle && (
                <div className="text-muted-foreground">{offer.title}</div>
              )}

              {offer.problems.length > 0 && (
                <div className="mt-1 text-destructive">
                  {offer.problems.join("; ")}
                </div>
              )}
            </td>

            <td className="py-2">{offer.sku || "—"}</td>

            <td className="py-2 text-muted-foreground">{offer.barcode ?? "—"}</td>

            <td className="py-2 whitespace-nowrap">
              {offer.price === null ? (
                "—"
              ) : offer.discountPrice === null ? (
                priceFormatter.format(offer.price)
              ) : (
                <>
                  <div>{priceFormatter.format(offer.discountPrice)}</div>
                  <div className="text-muted-foreground line-through">
                    {priceFormatter.format(offer.price)}
                  </div>
                  <div className="text-destructive">−{offer.discountPercent}%</div>
                </>
              )}
            </td>

            <td className="py-2 whitespace-nowrap">{stockLabel(offer)}</td>

            <td className="py-2">{offer.warehouses.join(", ") || "—"}</td>

            <td className="py-2 whitespace-nowrap">
              {offer.sizeCm === null ? "—" : `${offer.sizeCm} см`}
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
