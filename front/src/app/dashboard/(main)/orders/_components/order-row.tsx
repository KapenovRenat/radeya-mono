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
 *
 * Общие для всех источников: они заполнены и у заказа площадки, и у продажи
 * с витрины.
 */
const COMMON_COLUMNS = [
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

/**
 * Колонки офлайн-продажи.
 *
 * У заказов площадки они пустые: Kaspi платит целиком и сразу, скидку считает
 * сам, а наших справочников не знает. Поэтому при выбранной площадке они
 * прячутся — иначе восемь колонок таблицы состоят из прочерков.
 */
const OFFLINE_COLUMNS = [
  { title: "Номер заказа", className: styles.colExternal },
  { title: "Откуда товар", className: styles.colOffline },
  { title: "Статус доставки", className: styles.colOffline },
  { title: "Откуда клиент", className: styles.colOffline },
  { title: "Оплата", className: styles.colOffline },
  { title: "Скидка", className: styles.colOffline },
  { title: "Оплачено", className: styles.colTotal },
  { title: "Остаток", className: styles.colTotal },
] as const;

export function orderColumnCount(showOffline: boolean): number {
  return COMMON_COLUMNS.length + (showOffline ? OFFLINE_COLUMNS.length : 0);
}

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

export function OrderTableHead({ showOffline }: { showOffline: boolean }) {
  const columns = showOffline
    ? [...COMMON_COLUMNS, ...OFFLINE_COLUMNS]
    : COMMON_COLUMNS;

  return (
    <tr>
      {columns.map((column) => (
        <th key={column.title} scope="col" className={column.className}>{column.title}</th>
      ))}
    </tr>
  );
}

/**
 * Скидка — это пара «сколько процентов» и «почему».
 *
 * Показываем обе части: `10% · Ликвидация`. Причина без процента бывает
 * («800тг» из импорта), процент без причины тоже — но когда есть обе,
 * прятать одну нельзя: процент объясняет сумму, а причина — процент.
 */
function discountTitle(order: OrderRowDto): string | null {
  const parts: string[] = [];

  if (order.discountPercent !== null) parts.push(order.discountPercent + "%");
  if (order.discountComment !== null) parts.push(order.discountComment);

  return parts.length === 0 ? null : parts.join(" · ");
}

export function OrderRow({ order, showOffline }: { order: OrderRowDto; showOffline: boolean }) {
  const total = moneyToNumber(order.totalPrice);
  const paid = moneyToNumber(order.paidAmount);
  const balance = moneyToNumber(order.balanceDue);
  const customer = customerTitle(order);
  const discount = discountTitle(order);

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

      {/* У офлайн-предзаказа доставку ещё не выбрали — прочерк честнее
          подставленного наугад «своей доставки». */}
      <td className={styles.colDelivery}>
        {order.deliveryType === null
          ? <span className={styles.muted}>—</span>
          : ORDER_DELIVERY_TYPE_LABELS[order.deliveryType]}
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

      {showOffline && (
        <>
          <td className={styles.colExternal}>
            {order.externalNumber ?? <span className={styles.muted}>—</span>}
          </td>

          <td className={styles.colOffline}>
            {order.shipmentOrigin ?? <span className={styles.muted}>—</span>}
          </td>

          <td className={styles.colOffline}>
            {order.deliveryStatus ?? <span className={styles.muted}>—</span>}
          </td>

          <td className={styles.colOffline}>
            {order.customerSource ?? <span className={styles.muted}>—</span>}
          </td>

          <td className={styles.colOffline}>
            {order.paymentMethod ?? <span className={styles.muted}>—</span>}
          </td>

          <td className={styles.colOffline}>
            {discount ?? <span className={styles.muted}>—</span>}
          </td>

          <td className={styles.colTotal}>
            {paid === null ? <span className={styles.muted}>—</span> : formatMoney(paid)}
          </td>

          {/* Ноль — это «оплачено», а не «ничего не должен»: так написано
              в рабочей таблице, и так его читает человек. */}
          <td className={styles.colTotal}>
            {balance === null
              ? <span className={styles.muted}>—</span>
              : balance === 0
                ? <span className={styles.paid}>оплачено</span>
                : formatMoney(balance)}
          </td>
        </>
      )}

    </tr>
  );
}
