import { ORDER_DELIVERY_TYPES, variantDisplayName } from '@radeya/shared';

import type { Prisma } from '../../../../../generated/prisma/client';
import { formatAstanaDay } from '../../../../../lib/astana-time';
import { largeImageUrl } from '../../../../products/catalog.mapper';
import { CARD_ADDRESS_MAX_LENGTH, KASPI_LOGISTICS_NAME } from './dispatch.constants';
import type { OrderCardData, OrderCardKind } from './order-card';

/**
 * Что нужно отправке от заказа и позиции — одна выборка на новые заказы,
 * отмены и возвраты, чтобы карточки не разошлись в мелочах.
 */
export const dispatchOrderSelect = {
  id: true, code: true, placedAt: true, createdAt: true, status: true, preOrder: true,
  deliveryType: true, plannedPointDeliveryAt: true, plannedDeliveryAt: true, cabinetSyncedAt: true,
  originCityName: true, originFormattedAddress: true,
  deliveryTown: true, deliveryFormattedAddress: true, deliveryStreetName: true,
  deliveryStreetNumber: true, deliveryApartment: true,
  salesPoint: { select: { name: true } },
  warehouse: {
    select: {
      id: true, code: true, name: true,
      kaspiDeliveryChatId: true, ownDeliveryChatId: true, pickupChatId: true,
    },
  },
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

/**
 * Одинаково для поставщика и группы склада — что делать, говорит вид доставки:
 * Kaspi Доставка — «Отгрузка на Zammler» и дата сдачи; своя доставка — адрес
 * клиента и дата доставки; самовывоз — пункт выдачи и дата выдачи.
 */
export function buildCardData(kind: OrderCardKind, order: DispatchOrder, entry: DispatchEntry): OrderCardData {
  const city = shipmentCity(order);

  return {
    kind,
    orderCode: order.code,
    salesPointName: order.salesPoint.name,
    isPreOrder: order.preOrder,
    shipment: describeShipment(order, city),
    address: describeAddress(order),
    dateLine: describeDate(order),
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
  // Город своей доставки — в строке адреса ниже.
  if (order.deliveryType === ORDER_DELIVERY_TYPES.OWN) return 'Своя доставка';
  if (order.deliveryType === ORDER_DELIVERY_TYPES.PICKUP) return 'Самовывоз';

  return 'Способ доставки не указан';
}

/**
 * Куда везти или где заберут. У Kaspi Доставки адреса нет — везут на Zammler,
 * а домашний адрес площадка не отдаёт.
 */
function describeAddress(order: DispatchOrder): string | null {
  if (order.deliveryType === ORDER_DELIVERY_TYPES.OWN) {
    const address = order.deliveryFormattedAddress ?? composeAddress(order);

    return address ? clip(`Адрес: ${address}`) : 'Адрес: не указан — уточните в заказе';
  }

  if (order.deliveryType === ORDER_DELIVERY_TYPES.PICKUP) {
    const point = [order.warehouse?.name ?? order.warehouse?.code, order.originFormattedAddress]
      .filter(Boolean)
      .join(', ');

    return point ? clip(`Пункт выдачи: ${point}`) : null;
  }

  return null;
}

/** Адрес из частей, если Kaspi не прислал готовую строку. */
function composeAddress(order: DispatchOrder): string | null {
  const street = [order.deliveryStreetName, order.deliveryStreetNumber].filter(Boolean).join(' ');
  const parts = [
    order.deliveryTown,
    street || null,
    order.deliveryApartment ? `кв. ${order.deliveryApartment}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : null;
}

/** Дата под видом доставки: у Kaspi — сдачи на Zammler, у остальных — клиенту. */
function describeDate(order: DispatchOrder): string | null {
  if (order.deliveryType === ORDER_DELIVERY_TYPES.KASPI) {
    return order.plannedPointDeliveryAt ? `Дата сдачи: ${formatAstanaDay(order.plannedPointDeliveryAt)}` : null;
  }

  if (order.plannedDeliveryAt === null) return null;

  const label = order.deliveryType === ORDER_DELIVERY_TYPES.PICKUP ? 'Дата выдачи' : 'Дата доставки';

  return `${label}: ${formatAstanaDay(order.plannedDeliveryAt)}`;
}

function clip(value: string): string {
  return value.length > CARD_ADDRESS_MAX_LENGTH ? `${value.slice(0, CARD_ADDRESS_MAX_LENGTH - 1)}…` : value;
}

/** Действие для получателя — как в старой админке (telegram-bot.md, §5). */
function describeAction(kind: OrderCardKind, city: string): string | null {
  if (kind === 'CANCEL_IN_TRANSIT') return `Забрать с ${KASPI_LOGISTICS_NAME} в г. ${city}`;
  if (kind === 'CANCEL_BY_CUSTOMER') return 'Складировать';
  if (kind === 'RETURN') return 'Принять возврат';

  return null;
}
