import { Pencil } from "lucide-react";
import {
  LISTING_STATUSES,
  LISTING_STATUS_LABELS,
  SALES_CHANNELS,
  SALES_CHANNEL_LABELS,
  type CatalogRowDto,
} from "@radeya/shared";

import { Checkbox } from "@/components/checkbox";
import { Dropdown } from "@/components/dropdown";
import { formatMoney, moneyToNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import styles from "./catalog-row.module.scss";

/**
 * Колонки с подписями. Класс колонки задаётся здесь один раз и применяется
 * и к шапке, и к ячейке — иначе ширина и выравнивание разъезжаются.
 *
 * Галка выделения и меню действий в этот список не входят: подписей у них нет,
 * и разметка у них своя.
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

/** Подписанные колонки плюс галка и меню. Tables считает этим colSpan пустого состояния. */
export const CATALOG_COLUMN_COUNT = COLUMNS.length + 2;

interface CatalogTableHeadProps {
  /** Выбрана вся страница. */
  allSelected: boolean;
  /** Выбрано что-то, но не всё: галка показывает чёрточку вместо птички. */
  someSelected: boolean;
  onSelectAll: (selected: boolean) => void;
  disabled?: boolean;
}

export function CatalogTableHead({ allSelected, someSelected, onSelectAll,
  disabled = false }: CatalogTableHeadProps) {
  return (
    <tr>
      <th scope="col" className={styles.colSelect}>
        <Checkbox
          checked={allSelected}
          indeterminate={!allSelected && someSelected}
          disabled={disabled}
          aria-label="Выделить все товары на странице"
          onChange={(event) => onSelectAll(event.target.checked)}
        />
      </th>

      {COLUMNS.map((column) => (
        <th key={column.title} scope="col" className={column.className}>{column.title}</th>
      ))}

      {/* Подписи у колонки действий нет, но ячейка в шапке нужна: без неё
          съедет выравнивание и закреплённое меню встанет не под своей колонкой. */}
      <th scope="col" className={styles.colActions}>
        <span className={styles.srOnly}>Действия</span>
      </th>
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
export function CatalogRow({ item, selected, onSelectedChange, disabled = false }: {
  item: CatalogRowDto;
  selected: boolean;
  /** Выделение живёт на Product: переносится товар целиком, со всеми модификациями. */
  onSelectedChange: (productId: string, selected: boolean) => void;
  disabled?: boolean;
}) {
  const listing = item.listings.find((entry) => entry.channel === SALES_CHANNELS.KASPI);
  const isOnSale = item.status === LISTING_STATUSES.ON_SALE;

  // Скидка есть — она и есть текущая цена, основная уходит в зачёркнутую.
  const discount = moneyToNumber(listing?.discountPrice ?? null);
  const base = moneyToNumber(listing?.price ?? null);
  const price = discount ?? base;
  const oldPrice = discount !== null ? base : null;

  return (
    <tr className={cn(styles.row, selected && styles.rowSelected)}>

      <td className={styles.colSelect}>
        <Checkbox
          checked={selected}
          disabled={disabled}
          aria-label={"Выбрать «" + item.name + "», артикул " + item.sku}
          onChange={(event) => onSelectedChange(item.productId, event.target.checked)}
        />
      </td>

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

      {/*
        Меню закреплено у правого края: колонка sticky, поэтому при
        горизонтальной прокрутке таблицы точки остаются на виду рядом
        со своим товаром, а не уезжают за кадр вместе со складами.
      */}
      <td className={styles.colActions}>
        <Dropdown
          label={"Действия с «" + item.sku + "»"}
          disabled={disabled}
          items={[{
            label: "Редактировать",
            icon: <Pencil size={16} />,
            // Карточки товара пока нет — пункт на месте, но неактивен.
            disabled: true,
            onSelect: () => undefined,
          }]}
        />
      </td>

    </tr>
  );
}
