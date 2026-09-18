import {
  LISTING_STATUSES,
  LISTING_STATUS_LABELS,
  SALES_CHANNELS,
  SALES_CHANNEL_LABELS,
  type CatalogRowDto,
} from "@radeya/shared";

import { formatMoney, moneyToNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import styles from "./catalog-row.module.scss";

/**
 * Колонки таблицы. Класс колонки задаётся здесь один раз и применяется
 * и к шапке, и к ячейке — иначе ширина и выравнивание разъезжаются.
 * Отсюда же берётся количество колонок: Tables нужен colSpan для пустого состояния.
 */
const COLUMNS = [
  { title: "Статус", className: styles.colStatus },
  { title: "Фото", className: styles.colImage },
  { title: "Товар", className: styles.colName },
  { title: "Артикул", className: styles.colSku },
  // Цена принадлежит каналу, а не товару: на сайте она будет своя.
  { title: "Цена " + SALES_CHANNEL_LABELS[SALES_CHANNELS.KASPI], className: styles.colPrice },
  { title: "Предзаказ", className: styles.colPreOrder },
  { title: "Склады", className: styles.colStock },
] as const;

export const CATALOG_COLUMN_COUNT = COLUMNS.length;

export function CatalogTableHead() {
  return (
    <tr>
      {COLUMNS.map((column) => (
        <th key={column.title} scope="col" className={column.className}>{column.title}</th>
      ))}
    </tr>
  );
}

/**
 * Строка каталога.
 *
 * Цену берём у размещения на Kaspi по каналу, а не по индексу массива:
 * появится цена сайта — и нулевым окажется не тот элемент, порядок задаёт
 * сортировка по названию канала.
 */
export function CatalogRow({ item }: { item: CatalogRowDto }) {
  const listing = item.listings.find((entry) => entry.channel === SALES_CHANNELS.KASPI);
  const isOnSale = item.status === LISTING_STATUSES.ON_SALE;

  // Скидка есть — она и есть текущая цена, основная уходит в зачёркнутую.
  const discount = moneyToNumber(listing?.discountPrice ?? null);
  const base = moneyToNumber(listing?.price ?? null);
  const price = discount ?? base;
  const oldPrice = discount !== null ? base : null;

  return (
    <tr className={styles.row}>

      <td className={styles.colStatus}>
        {/*
          Подпись убрана, смысл несёт только цвет — поэтому он обязан быть
          подписан иначе: role="img" с aria-label читается скринридером,
          title даёт подсказку под курсором. Без этого статус пропадает
          и для незрячего, и для того, кто не различает красный и зелёный.
        */}
        <span
          role="img"
          aria-label={LISTING_STATUS_LABELS[item.status]}
          title={LISTING_STATUS_LABELS[item.status]}
          className={cn(styles.dot, isOnSale ? styles.dotOn : styles.dotOff)}
        />
      </td>

      <td className={styles.colImage}>
        {item.imageUrl ? (
          // Не next/image: домен картинок Kaspi нужно прописывать в next.config.ts,
          // а адреса приходят из кабинета и могут добавиться новые.
          <img className={styles.image} src={item.imageUrl} alt="" width={64} height={64} loading="lazy" />
        ) : (
          <span className={styles.noImage}>нет фото</span>
        )}
      </td>

      <td className={styles.colName}>
        <div className={styles.names}>
          <span className={styles.master}>{item.kaspi.masterTitle ?? item.name}</span>
          {item.kaspi.title && item.kaspi.title !== item.kaspi.masterTitle && (
            <span className={styles.own}>{item.kaspi.title}</span>
          )}
        </div>
      </td>

      <td className={styles.colSku}>{item.sku}</td>

      <td className={styles.colPrice}>
        {price === null ? (
          <span className={styles.muted}>—</span>
        ) : (
          <span className={styles.price}>
            <span className={styles.priceCurrent}>{formatMoney(price)}</span>

            {/*
              Процент берём у сервера, а не считаем от двух цен: он приходит
              из кабинета, и обратный счёт расходится с фактическим на проценты.
            */}
            {oldPrice !== null && (
              <span className={styles.priceWas}>
                <s className={styles.priceOld}>{formatMoney(oldPrice)}</s>
                {listing !== undefined && listing.discountPercent > 0 && (
                  <span className={styles.priceBadge}>−{listing.discountPercent}%</span>
                )}
              </span>
            )}
          </span>
        )}
      </td>

      <td className={styles.colPreOrder}>
        {item.preOrderDays === 0
          ? <span className={styles.muted}>-</span>
          : item.preOrderDays + " дн."}
      </td>

      <td className={styles.colStock}>
        {item.stocks.length === 0 ? (
          <span className={styles.muted}>—</span>
        ) : (
          <span className={styles.warehouses}>
            {item.stocks.map((stock) => (
              <span key={stock.warehouse.id} className={styles.chip}>
                {stock.warehouse.name ?? stock.warehouse.code}
                {stock.quantity !== null && (
                  <span className={styles.chipCount}> · {stock.quantity}</span>
                )}
              </span>
            ))}
          </span>
        )}
      </td>

    </tr>
  );
}
