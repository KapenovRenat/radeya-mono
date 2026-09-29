import type { ReactNode } from "react";
import {
  ORDER_DELIVERY_TYPE_LABELS,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  type OrderRowDto,
  type OrderStatus,
} from "@radeya/shared";

import { customerTitle, discountTitle } from "@/features/orders/order-format";
import { formatDateTime, formatMoney, moneyToNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import styles from "./order-row.module.scss";

/**
 * Вид таблицы — от вида выбранной точки продаж.
 *
 * `marketplace` — Kaspi (и будущие OZON, сайт): склад отгрузки, без полей
 * офлайн-продажи — у площадки они всегда пустые.
 * `offline` — офлайн-точка: продавец и восемь колонок офлайн-продажи.
 */
export type OrderTableKind = "marketplace" | "offline";

interface Column {
  title: string;
  className: string;
  render: (order: OrderRowDto) => ReactNode;
}

const dash = <span className={styles.muted}>—</span>;

/** Пусто — прочерк: видно, что поле есть, а значения нет. */
function orDash(value: ReactNode) {
  return value === null || value === undefined || value === "" ? dash : value;
}

function money(value: string | null) {
  const amount = moneyToNumber(value);

  return amount === null ? dash : formatMoney(amount);
}

/**
 * Цвет кружка — свой у каждой стадии. Сами цвета — в order-row.module.scss.
 *
 * Record по всем стадиям, а не условия: появится новая стадия в ORDER_STATUSES —
 * TypeScript не соберёт проект, пока ей не дадут цвет, и она не станет молча
 * серой или «как у соседа».
 */
const STATUS_DOT: Record<OrderStatus, string> = {
  [ORDER_STATUSES.NEW]: styles.statusNew,
  [ORDER_STATUSES.SIGN_REQUIRED]: styles.statusSignRequired,
  [ORDER_STATUSES.PRE_ORDER]: styles.statusPreOrder,
  [ORDER_STATUSES.PACKING]: styles.statusPacking,
  [ORDER_STATUSES.TRANSMISSION]: styles.statusTransmission,
  [ORDER_STATUSES.TRANSMITTED]: styles.statusTransmitted,
  [ORDER_STATUSES.PICKUP]: styles.statusPickup,
  [ORDER_STATUSES.OWN_DELIVERY]: styles.statusOwnDelivery,
  [ORDER_STATUSES.DELIVERED]: styles.statusDelivered,
  [ORDER_STATUSES.CANCELLING]: styles.statusCancelling,
  [ORDER_STATUSES.CANCELLED]: styles.statusCancelled,
  [ORDER_STATUSES.RETURN_REQUESTED]: styles.statusReturnRequested,
  [ORDER_STATUSES.RETURNED]: styles.statusReturned,
};

export function statusDotClass(status: OrderStatus): string {
  return STATUS_DOT[status];
}

/**
 * Все колонки реестра — каждая описана один раз: заголовок, класс и что
 * показать. Набор для вида таблицы собирается ниже по ключам. Добавить или
 * переставить колонку — поправить список, разметка строки не меняется.
 */
const COLUMNS = {
  date: { title: "Дата и время", className: styles.colDate,
    render: (order) => formatDateTime(order.placedAt) },

  status: { title: "Статус", className: styles.colStatus,
    render: (order) => (
      <span className={styles.status}>
        {/* Цвет только дублирует подпись — от скринридера кружок скрыт. */}
        <span aria-hidden="true" className={cn(styles.dot, statusDotClass(order.status))} />
        {ORDER_STATUS_LABELS[order.status]}
      </span>
    ) },

  code: { title: "Номер", className: styles.colCode,
    render: (order) => order.code },

  customer: { title: "Покупатель", className: styles.colCustomer,
    render: (order) => {
      const customer = customerTitle(order);

      if (customer === null && order.customerPhone === null) return dash;

      return (
        <span className={styles.customer}>
          <span>{customer ?? "—"}</span>
          {/* У архивных заказов Kaspi отдаёт маску вместо телефона —
              показываем как есть, это честнее пустой ячейки. */}
          {order.customerPhone && <span className={styles.phone}>{order.customerPhone}</span>}
        </span>
      );
    } },

  town: { title: "Город", className: styles.colTown,
    render: (order) => orDash(order.deliveryTown) },

  warehouse: { title: "Склад", className: styles.colWarehouse,
    render: (order) => order.warehouse === null
      ? dash
      : order.warehouse.code + (order.warehouse.name === null ? "" : " · " + order.warehouse.name) },

  seller: { title: "Кто создал", className: styles.colSeller,
    render: (order) => orDash(order.seller?.name) },

  // У офлайн-предзаказа доставку ещё не выбрали — прочерк честнее
  // подставленного наугад «своей доставки».
  delivery: { title: "Доставка", className: styles.colDelivery,
    render: (order) => order.deliveryType === null
      ? dash : ORDER_DELIVERY_TYPE_LABELS[order.deliveryType] },

  total: { title: "Сумма", className: styles.colTotal,
    render: (order) => money(order.totalPrice) },

  planned: { title: "Планируемая доставка", className: styles.colPlanned,
    render: (order) => order.plannedDeliveryAt === null
      ? dash : formatDateTime(order.plannedDeliveryAt) },

  externalNumber: { title: "Номер заказа", className: styles.colExternal,
    render: (order) => orDash(order.externalNumber) },

  shipmentOrigin: { title: "Откуда товар", className: styles.colOffline,
    render: (order) => orDash(order.shipmentOrigin) },

  deliveryStatus: { title: "Статус доставки", className: styles.colOffline,
    render: (order) => orDash(order.deliveryStatus) },

  customerSource: { title: "Откуда клиент", className: styles.colOffline,
    render: (order) => orDash(order.customerSource) },

  paymentMethod: { title: "Оплата", className: styles.colOffline,
    render: (order) => orDash(order.paymentMethod) },

  discount: { title: "Скидка", className: styles.colOffline,
    render: (order) => orDash(discountTitle(order)) },

  paid: { title: "Оплачено", className: styles.colTotal,
    render: (order) => money(order.paidAmount) },

  // Ноль — это «оплачено»: так написано в рабочей таблице, и так его читает человек.
  balance: { title: "Остаток", className: styles.colTotal,
    render: (order) => {
      const balance = moneyToNumber(order.balanceDue);

      if (balance === null) return dash;

      return balance === 0 ? <span className={styles.paid}>оплачено</span> : formatMoney(balance);
    } },
} satisfies Record<string, Column>;

type ColumnKey = keyof typeof COLUMNS;

/**
 * Какие колонки у какого вида таблицы. «Точки продаж» нет ни в одном:
 * точка выбрана в фильтре, и у всех строк она одна и та же.
 */
const TABLE_COLUMNS: Record<OrderTableKind, ColumnKey[]> = {
  marketplace: ["date", "status", "code", "customer", "town", "warehouse", "delivery",
    "total", "planned"],
  offline: ["date", "status", "code", "customer", "town", "seller", "delivery", "total",
    "planned", "externalNumber", "shipmentOrigin", "deliveryStatus", "customerSource",
    "paymentMethod", "discount", "paid", "balance"],
};

export function orderColumnCount(kind: OrderTableKind): number {
  return TABLE_COLUMNS[kind].length;
}

export function OrderTableHead({ kind }: { kind: OrderTableKind }) {
  return (
    <tr>
      {TABLE_COLUMNS[kind].map((key) => (
        <th key={key} scope="col" className={COLUMNS[key].className}>{COLUMNS[key].title}</th>
      ))}
    </tr>
  );
}

/**
 * Строка реестра. Клик по строке открывает заказ; с клавиатуры — номер
 * заказа, он кнопка: у строки таблицы роли кнопки нет, и Tab её не находит.
 */
export function OrderRow({ order, kind, onOpen }: {
  order: OrderRowDto;
  kind: OrderTableKind;
  onOpen: (orderId: string) => void;
}) {
  return (
    <tr className={cn(styles.row, styles.rowClickable)} onClick={() => onOpen(order.id)}>
      {TABLE_COLUMNS[kind].map((key) => (
        <td key={key} className={COLUMNS[key].className}>
          {key === "code" ? (
            <button
              type="button"
              className={styles.codeButton}
              onClick={(event) => {
                // Клик уже поймает строка — второй раз окно не открываем.
                event.stopPropagation();
                onOpen(order.id);
              }}
            >
              {order.code}
            </button>
          ) : COLUMNS[key].render(order)}
        </td>
      ))}
    </tr>
  );
}
