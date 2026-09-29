import type { OrderDetailsDto, OrderEntryDto } from "@radeya/shared";

import { Button } from "@/components/button";
import { Loader } from "@/components/loader";
import { formatMoney, moneyToNumber } from "@/lib/format";
import { DetailsSection } from "./details-section";
import styles from "./style.module.scss";

function money(value: string | null) {
  const amount = moneyToNumber(value);

  return amount === null ? <span className={styles.muted}>—</span> : formatMoney(amount);
}

/**
 * Товар позиции: наш из каталога, если артикул нашёлся, иначе название
 * с площадки и пометка — чтобы было видно, что товар надо завести.
 */
function EntryProduct({ entry }: { entry: OrderEntryDto }) {
  if (entry.variant !== null) {
    return (
      <span className={styles.product}>
        <span className={styles.productName}>{entry.variant.name}</span>
        <span className={styles.productMeta}>{entry.variant.sku}</span>
        {entry.note && <span className={styles.productMeta}>{entry.note}</span>}
      </span>
    );
  }

  return (
    <span className={styles.product}>
      <span className={styles.productName}>{entry.offerName ?? "Без названия"}</span>
      <span className={styles.productMeta}>{entry.sku ?? "артикул не указан"}</span>
      <span className={styles.notInCatalog}>нет в каталоге</span>
      {entry.note && <span className={styles.productMeta}>{entry.note}</span>}
    </span>
  );
}

/**
 * Состав заказа. Для заказа Kaspi при первом открытии он забирается с площадки —
 * пока идёт запрос, здесь загрузчик, остальное окно уже видно.
 */
export function EntriesSection({ order, isLoading, error, onRetry }: {
  order: OrderDetailsDto;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const waiting = isLoading || (order.canLoadEntries && !order.entriesLoaded && error === null);

  return (
    <DetailsSection title="Состав" wide>
      {waiting && (
        <div className={styles.state}>
          <Loader size={24} hideLabel />
          Загружаю состав заказа из Kaspi…
        </div>
      )}

      {!waiting && error !== null && (
        <div className={styles.state}>
          <span role="alert" className={styles.error}>{error}</span>
          <Button className="" type="button" onClick={onRetry}>Повторить</Button>
        </div>
      )}

      {!waiting && error === null && order.entries.length === 0 && (
        <p className={styles.muted}>
          {order.canLoadEntries ? "Kaspi не вернул позиций по этому заказу." : "Состав не указан."}
        </p>
      )}

      {order.entries.length > 0 && (
        <table className={styles.entries}>
          <caption className="sr-only">Позиции заказа {order.code}</caption>
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Фото</span></th>
              <th scope="col">Товар</th>
              <th scope="col" className={styles.num}>Кол-во</th>
              <th scope="col" className={styles.num}>Цена</th>
              <th scope="col" className={styles.num}>Сумма</th>
            </tr>
          </thead>
          <tbody>
            {order.entries.map((entry) => (
              <tr key={entry.id}>
                <td>
                  {entry.variant?.imageUrl ? (
                    // Не next/image: домены картинок Kaspi пришлось бы прописывать в конфиге.
                    <img className={styles.image} src={entry.variant.imageUrl} alt=""
                      width={48} height={48} loading="lazy" />
                  ) : (
                    <span className={styles.noImage}>нет фото</span>
                  )}
                </td>
                <td><EntryProduct entry={entry} /></td>
                <td className={styles.num}>{entry.quantity}</td>
                <td className={styles.num}>{money(entry.basePrice)}</td>
                <td className={styles.num}>{money(entry.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DetailsSection>
  );
}
