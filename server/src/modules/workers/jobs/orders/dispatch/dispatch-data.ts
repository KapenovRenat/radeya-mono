import { ORDER_DELIVERY_TYPES, variantDisplayName } from '@radeya/shared';

import type { Prisma } from '../../../../../generated/prisma/client';
import { formatAstanaDay } from '../../../../../lib/astana-time';
import { largeImageUrl } from '../../../../products/catalog.mapper';
import { KASPI_LOGISTICS_NAME } from './dispatch.constants';
import type { OrderCardData, OrderCardKind } from './order-card';

/**
 * Что нужно отправке от заказа и позиции — одна выборка на новые заказы,
 * отмены и возвраты, чтобы карточки не разошлись в мелочах.
 */
export const dispatchOrderSelect = {
  id: true, code: true, placedAt: true, createdAt: true, status: true, preOrder: true,
  deliveryType: true, plannedPointDeliveryAt: true, cabinetSyncedAt: true,
  originCityName: true, deliveryTown: true,
  salesPoint: { select: { name: true } },
  warehouse: { select: { id: true, code: true, name: true, telegramChatId: true } },
} as const satisfies Prisma.OrderSelect;

export const dispatchEntrySelect = {
  id: true, sku: true, offerName: true, quantity: true,
  variant: {
    select: {
      sku: true, kaspiMasterTitle: true, kaspiImages: true,
      product: { select: { name: true } },
      fabric: { select: { name: true } },
      supplier: { select: { id: true, name: true, telegramId: true } },
    },
  },
} as const satisfies Prisma.OrderEntrySelect;

export type DispatchOrder = Prisma.OrderGetPayload<{ select: typeof dispatchOrderSelect }>;
export type DispatchEntry = Prisma.OrderEntryGetPayload<{ select: typeof dispatchEntrySelect }>;

/** Название позиции — как в каталоге; товара в каталоге нет — как пришло с площадки. */
export function entryName(entry: DispatchEntry): string {
  if (entry.variant) return variantDisplayName(entry.variant.kaspiMasterTitle, entry.variant.product.name);

  return entry.offerName ?? entry.sku ?? 'Товар без названия';
}

/** Город отгрузки: снимок из заказа, иначе название склада. */
function shipmentCity(order: DispatchOrder): string {
  return order.originCityName ?? order.warehouse?.name ?? '—';
}

export function buildCardData(kind: OrderCardKind, order: DispatchOrder, entry: DispatchEntry): OrderCardData {
  const isKaspiDelivery = order.deliveryType === ORDER_DELIVERY_TYPES.KASPI;
  const city = shipmentCity(order);

  return {
    kind,
    orderCode: order.code,
    salesPointName: order.salesPoint.name,
    isPreOrder: order.preOrder,
    shipment: describeShipment(order, city),
    // Даты сдачи не бывает у своей доставки и самовывоза — там свой текст в shipment.
    handoverDate: isKaspiDelivery && order.plannedPointDeliveryAt
      ? formatAstanaDay(order.plannedPointDeliveryAt)
      : null,
    productName: entryName(entry),
    fabric: entry.variant?.fabric?.name ?? null,
    sku: entry.variant?.sku ?? entry.sku,
    quantity: entry.quantity,
    imageUrl: entry.variant ? largeImageUrl(entry.variant.kaspiImages) : null,
    action: describeAction(kind, city),
  };
}

function describeShipment(order: DispatchOrder, city: string): string {
  if (order.deliveryType === ORDER_DELIVERY_TYPES.KASPI) return `Отгрузка на ${KASPI_LOGISTICS_NAME} в г. ${city}`;
  if (order.deliveryType === ORDER_DELIVERY_TYPES.OWN) {
    return order.deliveryTown ? `Своя доставка · г. ${order.deliveryTown}` : 'Своя доставка';
  }
  if (order.deliveryType === ORDER_DELIVERY_TYPES.PICKUP) return 'Самовывоз';

  return 'Способ доставки не указан';
}

/** Действие для получателя — как в старой админке (telegram-bot.md, §5). */
function describeAction(kind: OrderCardKind, city: string): string | null {
  if (kind === 'CANCEL_IN_TRANSIT') return `Забрать с ${KASPI_LOGISTICS_NAME} в г. ${city}`;
  if (kind === 'CANCEL_BY_CUSTOMER') return 'Складировать';
  if (kind === 'RETURN') return 'Принять возврат';

  return null;
}
