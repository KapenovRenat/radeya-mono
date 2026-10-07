import { useMemo, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil } from "lucide-react";
import {
  CATALOG_SORT_KEYS,
  PERMISSIONS,
  CURRENCY_LABELS,
  LISTING_STATUSES,
  LISTING_STATUS_LABELS,
  SALES_CHANNELS,
  SALES_CHANNEL_LABELS,
  SORT_ORDERS,
  variantDisplayName,
  type CatalogRowDto,
  type CatalogSortKey,
  type Permission,
  type SortOrder,
} from "@radeya/shared";

import { Checkbox } from "@/components/checkbox";
import { Dropdown } from "@/components/dropdown";
import { useCan } from "@/features/auth/use-can";
import { formatMoney, moneyToNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import styles from "./catalog-row.module.scss";

/**
 * Колонки с подписями. Класс колонки задаётся здесь один раз и применяется
 * и к шапке, и к ячейке — иначе ширина и выравнивание разъезжаются.
 *
 * `permission` — кому колонка видна; не указано — всем. Для денег — те же
 * права, по которым сервер не отдаёт сами значения.
 *
 * Галка выделения и меню действий в этот список не входят: подписей у них нет,
 * и разметка у них своя.
 */
const COLUMNS: {
  title: string;
  className: string;
  sort?: CatalogSortKey;
  permission?: Permission;
}[] = [
  { title: "Статус", className: styles.colStatus },
  { title: "Фото", className: styles.colImage },
  { title: "Товар", className: styles.colName },
  { title: "Артикул", className: styles.colSku },
  // Цена принадлежит каналу, а не товару: на сайте она будет своя.
  { title: "Цена " + SALES_CHANNEL_LABELS[SALES_CHANNELS.KASPI], className: styles.colPrice,
    sort: CATALOG_SORT_KEYS.PRICE },
  // Закупка и поставщик приезжают из МойСклада. Валюта у закупки своя
  // и в подпись колонки не выносится: у соседних строк она разная.
  { title: "Закупка", className: styles.colPurchase, sort: CATALOG_SORT_KEYS.PURCHASE_PRICE,
    permission: PERMISSIONS.CATALOG_VIEW_PURCHASE },
  // Себестоимость всегда в тенге — символ стоит у суммы, как у закупки.
  { title: "Себестоимость", className: styles.colPurchase, permission: PERMISSIONS.CATALOG_VIEW_COST },
  { title: "Поставщик", className: styles.colSupplier },
  // Склад и его цифры — отдельными колонками, но строки внутри ячеек идут
  // в одном порядке: первая строка каждой колонки — первый склад.
  // Сортировка по ним — по сумме складов (при фильтре — выбранных).
  { title: "Склады", className: styles.colStock },
  { title: "Остаток", className: styles.colStockNum, sort: CATALOG_SORT_KEYS.QUANTITY },
  { title: "Резерв", className: styles.colStockNum, sort: CATALOG_SORT_KEYS.RESERVED },
  { title: "Ожидание", className: styles.colStockNum, sort: CATALOG_SORT_KEYS.EXPECTED },
  { title: "Доступно", className: styles.colStockNum, sort: CATALOG_SORT_KEYS.AVAILABLE },
  { title: "Предзаказ", className: styles.colStockNum, sort: CATALOG_SORT_KEYS.PRE_ORDER_DAYS },
  { title: "Дней на складе", className: styles.colStockNum, sort: CATALOG_SORT_KEYS.DAYS_ON_STOCK },
];

type Stock = CatalogRowDto["stocks"][number];

/**
 * Значение по каждому складу — строкой на склад.
 *
 * Высота строки у всех колонок складов одна (`--stock-line` в стилях):
 * иначе вторая строка «Остатка» съедет относительно второго склада.
 */
function StockLines({ stocks, render }: {
  stocks: Stock[];
  render: (stock: Stock) => ReactNode;
}) {
  if (stocks.length === 0) return <span className={styles.muted}>—</span>;

  return (
    <span className={styles.stockLines}>
      {stocks.map((stock) => (
        <span key={stock.warehouse.id} className={styles.stockLine}>{render(stock)}</span>
      ))}
    </span>
  );
}

/** Пусто — «не указано», а не ноль: прочерк, а не 0. */
function count(value: number | null) {
  return value === null ? <span className={styles.muted}>—</span> : value;
}

/** Колонки, видимые текущему пользователю. */
function useCatalogColumns() {
  const can = useCan();

  return useMemo(() => COLUMNS.filter((column) => can(column.permission)), [can]);
}

/** Видимые подписанные колонки плюс галка и меню. Tables считает этим colSpan пустого состояния. */
export function useCatalogColumnCount(): number {
  return useCatalogColumns().length + 2;
}

interface CatalogTableHeadProps {
  /** Выбрана вся страница. */
  allSelected: boolean;
  /** Выбрано что-то, но не всё: галка показывает чёрточку вместо птички. */
  someSelected: boolean;
  onSelectAll: (selected: boolean) => void;
  disabled?: boolean;
  /** Текущая сортировка; null — порядок по умолчанию. */
  sort: CatalogSortKey | null;
  order: SortOrder;
  onSort: (key: CatalogSortKey) => void;
}

/** Подпись для скринридера и подсказки: что сделает следующий клик. */
function nextSortHint(active: boolean, order: SortOrder): string {
  if (!active) return "Сортировать от большего к меньшему";
  return order === SORT_ORDERS.DESC ? "Сортировать от меньшего к большему" : "Убрать сортировку";
}

export function CatalogTableHead({ allSelected, someSelected, onSelectAll,
  disabled = false, sort, order, onSort }: CatalogTableHeadProps) {
  const columns = useCatalogColumns();

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

      {columns.map((column) => {
        if (column.sort === undefined) {
          return <th key={column.title} scope="col" className={column.className}>{column.title}</th>;
        }

        const key = column.sort;
        const active = sort === key;
        const Arrow = !active ? ArrowUpDown : order === SORT_ORDERS.DESC ? ArrowDown : ArrowUp;

        return (
          <th
            key={column.title}
            scope="col"
            className={column.className}
            aria-sort={!active ? "none" : order === SORT_ORDERS.DESC ? "descending" : "ascending"}
          >
            {/* Кнопка на всю подпись, а не только на стрелку: в стрелку
                шириной в 14 пикселей попасть мышью трудно. */}
            <button
              type="button"
              className={cn(styles.sortButton, active && styles.sortActive)}
              title={nextSortHint(active, order)}
              onClick={() => onSort(key)}
            >
              {column.title}
              <Arrow size={14} aria-hidden="true" className={styles.sortIcon} />
            </button>
          </th>
        );
      })}

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
  const can = useCan();
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
          <span className={styles.master}>{variantDisplayName(item.kaspi.masterTitle, item.name)}</span>
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

      {/* Права — те же, что у колонки в COLUMNS: иначе ячейки съедут под чужие подписи. */}
      {can(PERMISSIONS.CATALOG_VIEW_PURCHASE) && (
        <td className={styles.colPurchase}>
          {item.purchasePrice === null ? (
            <span className={styles.muted}>—</span>
          ) : (
            <>
              {/* Не formatMoney: он подставляет тенге, а закупка бывает в рублях.
                  Приводить к одной валюте нельзя — курса на дату закупки нет. */}
              {formatMoney(moneyToNumber(item.purchasePrice) ?? 0).replace("₸", "").trim()}
              {" "}
              {item.purchaseCurrency === null ? "?" : CURRENCY_LABELS[item.purchaseCurrency]}
            </>
          )}
        </td>
      )}

      {can(PERMISSIONS.CATALOG_VIEW_COST) && (
        <td className={styles.colPurchase}>
          {item.costPrice === null
            ? <span className={styles.muted}>—</span>
            : formatMoney(moneyToNumber(item.costPrice) ?? 0)}
        </td>
      )}

      <td className={styles.colSupplier} title={item.supplier?.name ?? undefined}>
        {item.supplier === null
          ? <span className={styles.muted}>—</span>
          : item.supplier.name}
      </td>

      <td className={styles.colStock}>
        {/* Код и название вместе: код — то, чем склад зовётся в Kaspi
            и в заказах, название — то, что понимает человек. */}
        <StockLines stocks={item.stocks} render={(stock) => (
          <span className={styles.chip}>
            {stock.warehouse.code}
            {stock.warehouse.name !== null && " · " + stock.warehouse.name}
          </span>
        )} />
      </td>

      <td className={styles.colStockNum}>
        <StockLines stocks={item.stocks} render={(stock) => count(stock.quantity)} />
      </td>

      <td className={styles.colStockNum}>
        <StockLines stocks={item.stocks} render={(stock) => count(stock.reserved)} />
      </td>

      <td className={styles.colStockNum}>
        <StockLines stocks={item.stocks} render={(stock) => count(stock.expected)} />
      </td>

      <td className={styles.colStockNum}>
        {/* Отрицательное «Доступно» — продано больше, чем есть и едет:
            выделено, потому что это требует действия. */}
        <StockLines stocks={item.stocks} render={(stock) => (
          <span className={cn(stock.available !== null && stock.available < 0 && styles.negative)}>
            {count(stock.available)}
          </span>
        )} />
      </td>

      <td className={styles.colStockNum}>
        {/* 0 — товар в наличии, срока нет. */}
        <StockLines stocks={item.stocks} render={(stock) => (
          stock.preOrderDays === 0
            ? <span className={styles.muted}>—</span>
            : stock.preOrderDays + " дн."
        )} />
      </td>

      <td className={styles.colStockNum}>
        <StockLines stocks={item.stocks} render={(stock) => count(stock.daysOnStock)} />
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
