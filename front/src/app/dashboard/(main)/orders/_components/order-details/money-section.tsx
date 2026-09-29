import { SALES_POINT_TYPES, type OrderDetailsDto } from "@radeya/shared";

import { discountTitle } from "@/features/orders/order-format";
import { formatMoney, moneyToNumber } from "@/lib/format";
import { DetailsSection, Field, Fields } from "./details-section";
import styles from "./style.module.scss";

function money(value: string | null) {
  const amount = moneyToNumber(value);

  return amount === null ? null : <span className={styles.money}>{formatMoney(amount)}</span>;
}

/**
 * Деньги. У площадки — сумма, доставка и способ оплаты Kaspi; у офлайн-точки —
 * ещё оплачено, остаток, скидка и наши справочники: Kaspi платит целиком
 * и сразу, недоплат и скидок продавца там не бывает.
 */
export function MoneySection({ order }: { order: OrderDetailsDto }) {
  const isOffline = order.salesPoint.type === SALES_POINT_TYPES.OFFLINE;
  const balance = moneyToNumber(order.balanceDue);

  return (
    <DetailsSection title="Оплата">
      <Fields>
        <Field label="Сумма">{money(order.totalPrice)}</Field>

        {!isOffline && (
          <>
            <Field label="Доставка">{money(order.deliveryCost)}</Field>
            <Field label="Способ оплаты">
              {order.paymentMode}
              {order.creditTerm !== null && <span className={styles.hint}>{order.creditTerm} мес.</span>}
            </Field>
          </>
        )}

        {isOffline && (
          <>
            <Field label="Оплата">{order.paymentMethod}</Field>
            <Field label="Оплачено">{money(order.paidAmount)}</Field>
            {/* Ноль — «оплачено»: так написано в рабочей таблице. */}
            <Field label="Остаток">{balance === 0 ? "оплачено" : money(order.balanceDue)}</Field>
            <Field label="Скидка">{discountTitle(order)}</Field>
            <Field label="Номер заказа">{order.externalNumber}</Field>
            <Field label="Откуда товар">{order.shipmentOrigin}</Field>
            <Field label="Статус доставки">{order.deliveryStatus}</Field>
            <Field label="Откуда клиент">{order.customerSource}</Field>
          </>
        )}
      </Fields>
    </DetailsSection>
  );
}
