import type { OrderDetailsDto } from "@radeya/shared";

import { customerTitle } from "@/features/orders/order-format";
import { DetailsSection, Field, Fields } from "./details-section";

/**
 * Покупатель и адрес. У Kaspi-доставки адрес почти всегда пуст — площадка
 * домашний адрес не отдаёт; он есть у своей доставки.
 */
export function CustomerSection({ order }: { order: OrderDetailsDto }) {
  return (
    <DetailsSection title="Покупатель">
      <Fields>
        <Field label="Имя">{customerTitle(order)}</Field>
        {/* У архивных заказов Kaspi отдаёт маску вместо телефона — показываем как есть. */}
        <Field label="Телефон">{order.customerPhone}</Field>
        <Field label="Город">{order.deliveryTown}</Field>
        <Field label="Адрес">{order.deliveryAddress}</Field>
        {order.deliveryComment && <Field label="Комментарий к доставке">{order.deliveryComment}</Field>}
        {order.originCityName && <Field label="Отгрузка из">{order.originCityName}</Field>}
      </Fields>
    </DetailsSection>
  );
}
