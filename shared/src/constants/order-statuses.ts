/**
 * Статусы заказов.
 *
 * Два независимых измерения, и путать их нельзя:
 *
 *   ORDER_DELIVERY_TYPES — как заказ едет. У заказа не меняется.
 *   ORDER_STATUSES       — на какой он стадии. Меняется по ходу.
 *
 * Значения обязаны совпадать с enum `OrderDeliveryType` и `OrderStatus`
 * в schema.prisma. Алгоритм вычисления — docs/kaspi-api-integration.md, раздел 5.
 */

export const ORDER_DELIVERY_TYPES = {
  KASPI: 'KASPI',
  PICKUP: 'PICKUP',
  OWN: 'OWN',
} as const;

export type OrderDeliveryType =
  (typeof ORDER_DELIVERY_TYPES)[keyof typeof ORDER_DELIVERY_TYPES];

export const ORDER_DELIVERY_TYPE_LABELS: Record<OrderDeliveryType, string> = {
  KASPI: 'Kaspi Доставка',
  PICKUP: 'Самовывоз',
  OWN: 'Своя доставка',
};

export const ORDER_STATUSES = {
  NEW: 'NEW',
  SIGN_REQUIRED: 'SIGN_REQUIRED',
  PRE_ORDER: 'PRE_ORDER',
  PACKING: 'PACKING',
  TRANSMISSION: 'TRANSMISSION',
  TRANSMITTED: 'TRANSMITTED',
  PICKUP: 'PICKUP',
  OWN_DELIVERY: 'OWN_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLING: 'CANCELLING',
  CANCELLED: 'CANCELLED',
  RETURN_REQUESTED: 'RETURN_REQUESTED',
  RETURNED: 'RETURNED',
} as const;

export type OrderStatus = (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES];

/** Подписи — как в кабинете Kaspi, чтобы не переучивать людей. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'Новый',
  SIGN_REQUIRED: 'На подписании',
  PRE_ORDER: 'Предзаказ',
  PACKING: 'Упаковка',
  TRANSMISSION: 'Передача',
  TRANSMITTED: 'Переданы на доставку',
  PICKUP: 'Самовывоз',
  OWN_DELIVERY: 'Своя доставка',
  DELIVERED: 'Доставлен',
  CANCELLING: 'Ожидают возврата/отмены',
  CANCELLED: 'Отменён',
  RETURN_REQUESTED: 'Ожидают решения по возврату',
  RETURNED: 'Возврат',
};

/**
 * Порядок стадий для списков и фильтров.
 *
 * Не алфавитный и не порядок enum: это путь заказа слева направо, отмены
 * и возвраты в конце. По нему же строится порядок вкладок на странице.
 */
export const ORDER_STATUS_ORDER: OrderStatus[] = [
  'NEW',
  'SIGN_REQUIRED',
  'PRE_ORDER',
  'PACKING',
  'TRANSMISSION',
  'TRANSMITTED',
  'PICKUP',
  'OWN_DELIVERY',
  'DELIVERED',
  'CANCELLING',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURNED',
];

/** Заказ закрыт: дальше он не двигается. */
export const ORDER_FINAL_STATUSES: OrderStatus[] = ['DELIVERED', 'CANCELLED', 'RETURNED'];
