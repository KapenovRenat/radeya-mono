import {
  ORDER_DELIVERY_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  SALES_POINT_TYPES,
  type OrderDetailsDto,
} from "@radeya/shared";

import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { statusDotClass } from "../order-row";
import rowStyles from "../order-row.module.scss";
import { DetailsSection, Field, Fields } from "./details-section";
import styles from "./style.module.scss";

/** Основное: номер, даты, стадия, откуда заказ и куда едет. */
export function SummarySection({ order }: { order: OrderDetailsDto }) {
  const isOffline = order.salesPoint.type === SALES_POINT_TYPES.OFFLINE;

  return (
    <DetailsSection title="Заказ">
      <Fields>
        <Field label="Номер">{order.code}</Field>
        <Field label="Дата и время">{formatDateTime(order.placedAt)}</Field>

        <Field label="Статус">
          <span className={styles.status}>
            <span aria-hidden="true" className={cn(rowStyles.dot, statusDotClass(order.status))} />
            {ORDER_STATUS_LABELS[order.status]}
          </span>
          {/* Сырой статус площадки рядом с нашим: расхождение видно сразу. */}
          {!isOffline && order.kaspiStatus !== "" && (
            <span className={styles.hint}>
              Kaspi: {order.kaspiStatus}{order.kaspiState ? " · " + order.kaspiState : ""}
            </span>
          )}
        </Field>

        {order.cancellationReason && <Field label="Причина отмены">{order.cancellationReason}</Field>}

        <Field label="Точка продаж">{order.salesPoint.name}</Field>
        {isOffline && <Field label="Кто создал">{order.seller?.name}</Field>}

        <Field label="Доставка">
          {order.deliveryType === null ? null : ORDER_DELIVERY_TYPE_LABELS[order.deliveryType]}
          {order.isExpress && <span className={styles.hint}>экспресс</span>}
        </Field>

        {!isOffline && (
          <Field label="Склад">
            {order.warehouse === null
              ? order.kaspiPickupPointId
              : order.warehouse.code + (order.warehouse.name ? " · " + order.warehouse.name : "")}
          </Field>
        )}

        {order.preOrder && <Field label="Предзаказ">да</Field>}

        {!isOffline && (
          <Field label="Передать курьеру до">
            {order.courierTransmissionPlannedAt && formatDateTime(order.courierTransmissionPlannedAt)}
          </Field>
        )}

        <Field label="Планируемая доставка">
          {order.plannedDeliveryAt && formatDateTime(order.plannedDeliveryAt)}
        </Field>

        {order.completedAt && <Field label="Завершён">{formatDateTime(order.completedAt)}</Field>}
        {!isOffline && <Field label="Накладная">{order.waybillNumber}</Field>}

        {/* Привязанная офлайн-продажа в статистику не идёт — посчитан заказ площадки. */}
        {order.linkedOrder && (
          <Field label="Привязан к заказу">
            {order.linkedOrder.code}
            <span className={styles.hint}>в статистике считается он</span>
          </Field>
        )}
      </Fields>
    </DetailsSection>
  );
}
