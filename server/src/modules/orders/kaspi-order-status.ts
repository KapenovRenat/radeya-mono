import {
  ORDER_DELIVERY_TYPES,
  ORDER_STATUSES,
  type OrderDeliveryType,
  type OrderStatus,
} from '@radeya/shared';

/**
 * Сведение полей Kaspi в нашу стадию заказа.
 *
 * Kaspi отдаёт `status` и `state` по отдельности, и ни одно из них не отвечает
 * на вопрос «что с заказом сейчас»: собранный и отменённый заказ имеет
 * `assembled = true` и `status = CANCELLED` одновременно.
 *
 * Алгоритм — docs/kaspi-api-integration.md, раздел 5.3. Порядок проверок
 * важен: отмены и возвраты идут раньше всего, иначе отменённый заказ,
 * который успели собрать, покажется «в упаковке».
 */

export interface StatusInput {
  status: string;
  state: string | null;
  isKaspiDelivery: boolean;
  preOrder: boolean;
  assembled: boolean;
  waybillNumber: string | null;
  courierTransmissionAt: string | null;
}

/**
 * Тип доставки.
 *
 * `DELIVERY_REGIONAL_PICKUP` сюда не участвует намеренно: это Kaspi-доставка
 * в пункт выдачи, а не самовывоз покупателем. Настоящий самовывоз виден
 * только по `state = PICKUP`.
 */
export function readDeliveryType(input: StatusInput): OrderDeliveryType {
  if (input.state === 'PICKUP') return ORDER_DELIVERY_TYPES.PICKUP;
  if (input.state === 'KASPI_DELIVERY' || input.isKaspiDelivery) return ORDER_DELIVERY_TYPES.KASPI;

  return ORDER_DELIVERY_TYPES.OWN;
}

/** Статусы Kaspi, означающие запрошенный возврат. Второе имя — у Kaspi-доставки. */
const RETURN_REQUESTED = ['RETURN_REQUESTED', 'KASPI_DELIVERY_RETURN_REQUESTED'];

/**
 * Значения, которые мы умеем разбирать.
 *
 * Полного списка от Kaspi у нас нет — эти собраны из документации проекта
 * (раздел 5.1) и с реальных ответов. Список неполон заведомо, поэтому
 * незнакомое значение не проглатывается молча, а помечается проблемой:
 * иначе новый статус площадки тихо станет «Новым», и расхождение
 * с кабинетом найдут не скоро.
 */
export const KNOWN_KASPI_STATUSES = [
  'APPROVED_BY_BANK',
  'ACCEPTED_BY_MERCHANT',
  'COMPLETED',
  'DELIVERED',
  'CANCELLING',
  'CANCELLED',
  'RETURNED',
  'RETURN_REQUESTED',
  'KASPI_DELIVERY_RETURN_REQUESTED',
];

export const KNOWN_KASPI_STATES = [
  'NEW',
  'SIGN_REQUIRED',
  'PICKUP',
  'DELIVERY',
  'KASPI_DELIVERY',
  'ARCHIVE',
];

export function isKnownStatus(value: string): boolean {
  return KNOWN_KASPI_STATUSES.includes(value);
}

export function isKnownState(value: string): boolean {
  return KNOWN_KASPI_STATES.includes(value);
}

export function readOrderStatus(input: StatusInput, deliveryType: OrderDeliveryType): OrderStatus {
  if (input.status === 'CANCELLED') return ORDER_STATUSES.CANCELLED;
  if (input.status === 'RETURNED') return ORDER_STATUSES.RETURNED;
  if (RETURN_REQUESTED.includes(input.status)) return ORDER_STATUSES.RETURN_REQUESTED;
  if (input.status === 'CANCELLING') return ORDER_STATUSES.CANCELLING;
  if (input.status === 'COMPLETED' || input.status === 'DELIVERED') return ORDER_STATUSES.DELIVERED;

  // Подпись перебивает стадию сборки: пока клиент не подписал договор
  // рассрочки, заказ не подтверждён, и трогать его нельзя.
  //
  // Проверка стоит выше «принят» намеренно: Kaspi ставит
  // ACCEPTED_BY_MERCHANT ещё до подписи, и иначе такой заказ попадал
  // в ветку принятых, где срабатывал preOrder, — получался «Предзаказ»,
  // тогда как кабинет и склад пишут «На подписании».
  // Проверено на заказе 1082757256, 21.09.2026:
  // status = ACCEPTED_BY_MERCHANT, state = SIGN_REQUIRED, накладной нет.
  if (input.state === 'SIGN_REQUIRED') return ORDER_STATUSES.SIGN_REQUIRED;

  // «Принят» определяем и по накладной: статус меняется с задержкой,
  // а waybillNumber появляется сразу — по нему надёжнее.
  const accepted = input.status === 'ACCEPTED_BY_MERCHANT' || input.waybillNumber !== null;

  if (accepted) {
    if (input.preOrder) return ORDER_STATUSES.PRE_ORDER;
    if (deliveryType === ORDER_DELIVERY_TYPES.PICKUP) return ORDER_STATUSES.PICKUP;
    if (deliveryType === ORDER_DELIVERY_TYPES.OWN) return ORDER_STATUSES.OWN_DELIVERY;
    if (input.courierTransmissionAt !== null) return ORDER_STATUSES.TRANSMITTED;
    if (input.assembled) return ORDER_STATUSES.TRANSMISSION;

    return ORDER_STATUSES.PACKING;
  }

  return ORDER_STATUSES.NEW;
}
