import {
  ORDER_DELIVERY_TYPE_LABELS,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  type OrderRowDto,
  type OrderStatus,
} from "@radeya/shared";

import { formatDateTime, formatMoney, moneyToNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import styles from "./order-row.module.scss";

/**
 * Колонки с подписями. Класс задаётся здесь один раз и применяется и к шапке,
 * и к ячейке — иначе ширина и выравнивание разъезжаются.
 */
const COLUMNS = [
  { title: "Дата и время", className: styles.colDate },
  { title: "Статус", className: styles.colStatus },
  { title: "Номер", className: styles.colCode },
  { title: "Покупатель", className: styles.colCustomer },
  { title: "Город", className: styles.colTown },
  { title: "Точка продаж", className: styles.colSalesPoint },
  { title: "Кто создал", className: styles.colSeller },
  { title: "Доставка", className: styles.colDelivery },
  { title: "Сумма", className: styles.colTotal },
  { title: "Планируемая доставка", className: styles.colPlanned },
] as const;

export const ORDER_COLUMN_COUNT = COLUMNS.length;

/** Успешно закрытые и сорвавшиеся — остальное считается «в работе». */
const DONE: OrderStatus[] = [ORDER_STATUSES.DELIVERED];
const FAILED: OrderStatus[] = [
  ORDER_STATUSES.CANCELLED,
  ORDER_STATUSES.CANCELLING,
  ORDER_STATUSES.RETURNED,
  ORDER_STATUSES.RETURN_REQUESTED,
];

function statusDot(status: OrderStatus): string {
  if (DONE.includes(status)) return styles.dotDone;
  if (FAILED.includes(status)) return styles.dotFailed;

  return styles.dotActive;
}

/**
 * Покупатель целиком: «А Аскарбек».
 *
 * `name` у Kaspi — это только имя, фамилия приходит отдельно и обычно одной
 * буквой. Показывать одно `name` значит терять фамилию, а по ней заказы и
 * ищут глазами. Порядок «фамилия, имя» — как в кабинете и на складе.
 */
function customerTitle(order: OrderRowDto): string | null {
  const parts = [order.customerLastName, order.customerFirstName].filter(Boolean);

  if (parts.length > 0) return parts.join(" ");

  return order.customerName;
}

export function OrderTableHead() {
  return (
    <tr>
      {COLUMNS.map((column) => (
        <th key={column.title} scope="col" className={column.className}>{column.title}</th>
      ))}
    </tr>
  );
}

export function OrderRow({ order }: { order: OrderRowDto }) {
  const total = moneyToNumber(order.totalPrice);
  const customer = customerTitle(order);

  return (
    <tr className={styles.row}>

      <td className={styles.colDate}>{formatDateTime(order.placedAt)}</td>

      <td className={styles.colStatus}>
        <span className={styles.status}>
          {/* Цвет только дублирует подпись, поэтому кружок скрыт
              от скринридера: читать его отдельно нечего. */}
          <span aria-hidden="true" className={cn(styles.dot, statusDot(order.status))} />
          {ORDER_STATUS_LABELS[order.status]}
          {/*{order.preOrder && <span className={styles.preOrder}>предзаказ</span>}*/}
        </span>
      </td>

      <td className={styles.colCode}>{order.code}</td>

      <td className={styles.colCustomer}>
        {customer === null && order.customerPhone === null ? (
          <span className={styles.muted}>—</span>
        ) : (
          <span className={styles.customer}>
            <span>{customer ?? "—"}</span>
            {/* У архивных заказов Kaspi отдаёт маску вместо телефона —
                показываем как есть, это честнее пустой ячейки. */}
            {order.customerPhone && <span className={styles.phone}>{order.customerPhone}</span>}
          </span>
        )}
      </td>

      <td className={styles.colTown}>
        {order.deliveryTown ?? <span className={styles.muted}>—</span>}
      </td>

      <td className={styles.colSalesPoint}>{order.salesPoint.name}</td>

      {/* Заказ площадки никто не заводил руками — там прочерк, а не название
          точки: оно уже стоит в соседней колонке, и повторять его незачем. */}
      <td className={styles.colSeller}>
        {order.seller === null
          ? <span className={styles.muted}>—</span>
          : order.seller.name}
      </td>

      <td className={styles.colDelivery}>
        {ORDER_DELIVERY_TYPE_LABELS[order.deliveryType]}
      </td>

      <td className={styles.colTotal}>
        {total === null ? <span className={styles.muted}>—</span> : formatMoney(total)}
      </td>

      {/* У отменённых и у тех, где Kaspi ещё не назначил срок, даты нет —
          прочерк честнее пустой ячейки: видно, что поле есть, а значения нет. */}
      <td className={styles.colPlanned}>
        {order.plannedDeliveryAt === null
          ? <span className={styles.muted}>—</span>
          : formatDateTime(order.plannedDeliveryAt)}
      </td>

    </tr>
  );
}
