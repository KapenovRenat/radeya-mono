import type { KaspiOrderDraft } from '@radeya/shared';

import { isKnownState, isKnownStatus, readDeliveryType, readOrderStatus,
  type StatusInput } from './kaspi-order-status';

/**
 * Сырой заказ Kaspi в нашу модель.
 *
 * Спорное не угадываем: чего нет или что пришло не в том виде, помечается
 * в `problems` и остаётся пустым. Молча подставленное значение выглядит
 * как настоящие данные, и ошибка всплывёт через месяц в отчёте.
 *
 * Поля кабинета (`cancelReason`, `steps`, зоны доставки, суммы рассрочки)
 * по токену не приходят — они всегда null. Так и задумано: их заполнит
 * отдельный проход, когда решится вопрос с доступом.
 */
export function toOrderDraft(raw: unknown): KaspiOrderDraft | null {
  if (!isRecord(raw)) return null;

  const attributes = isRecord(raw.attributes) ? raw.attributes : {};
  const problems: string[] = [];

  const code = asString(attributes.code);

  // Без номера заказ бесполезен: по нему сопоставляются оба источника
  // и по нему же ищут люди.
  if (code === null) return null;

  const customer = isRecord(attributes.customer) ? attributes.customer : {};
  const address = isRecord(attributes.deliveryAddress) ? attributes.deliveryAddress : {};
  const origin = isRecord(attributes.originAddress) ? attributes.originAddress : {};
  const originAddress = isRecord(origin.address) ? origin.address : {};
  const originCity = isRecord(origin.city) ? origin.city : {};
  const delivery = isRecord(attributes.kaspiDelivery) ? attributes.kaspiDelivery : {};

  const kaspiStatus = asString(attributes.status);
  const kaspiState = asString(attributes.state);

  if (kaspiStatus === null) problems.push('Нет статуса заказа');

  // Полного перечня значений у Kaspi нет, наш список заведомо неполон.
  // Незнакомое значение молча падало бы в «Новый» — а это расхождение
  // с кабинетом, которое найдут через месяц и не поймут откуда.
  if (kaspiStatus !== null && !isKnownStatus(kaspiStatus)) {
    problems.push(`Незнакомый статус Kaspi: ${kaspiStatus}`);
  }

  if (kaspiState !== null && !isKnownState(kaspiState)) {
    problems.push(`Незнакомый state Kaspi: ${kaspiState}`);
  }

  const statusInput: StatusInput = {
    status: kaspiStatus ?? '',
    state: kaspiState,
    isKaspiDelivery: attributes.isKaspiDelivery === true,
    preOrder: attributes.preOrder === true,
    assembled: attributes.assembled === true,
    waybillNumber: asString(delivery.waybillNumber),
    courierTransmissionAt: asDate(delivery.courierTransmissionDate),
    deliveryMode: asString(attributes.deliveryMode),
  };

  const deliveryType = readDeliveryType(statusInput);
  const placedAt = asDate(attributes.creationDate);

  if (placedAt === null) problems.push('Нет даты создания заказа');

  return {
    kaspiId: asString(raw.id),
    code,

    status: readOrderStatus(statusInput, deliveryType),
    deliveryType,
    kaspiStatus: kaspiStatus ?? '',
    kaspiState: statusInput.state,

    cancellationReason: asString(attributes.cancellationReason),
    cancelReason: null,
    cancelSubReason: null,
    moderated: null,
    moderatedReason: null,
    moderatedSubReason: null,

    // Дату оформления подменять текущим временем нельзя: заказ уедет не в тот
    // день, а по этим датам считается выручка.
    placedAt: placedAt ?? '',
    updatedAtKaspi: null,
    approvedByBankAt: asDate(attributes.approvedByBankDate),
    completedAt: asDate(attributes.completionDate),
    assembledAt: null,
    courierTransmissionAt: statusInput.courierTransmissionAt,
    courierTransmissionPlannedAt: asDate(delivery.courierTransmissionPlanningDate),
    // В части ответов поле есть, в части нет — читаем осторожно.
    plannedDeliveryAt: asDate(attributes.plannedDeliveryDate),
    actualDeliveryAt: null,
    returnedToWarehouseAt: null,
    returnedToWarehouseTimeoutAt: null,

    totalPrice: asMoney(attributes.totalPrice) ?? '0.00',
    deliveryCost: asMoney(attributes.deliveryCost),
    deliveryCostForSeller: asMoney(attributes.deliveryCostForSeller),
    loanAmount: null,
    paymentMode: asString(attributes.paymentMode),
    creditTerm: asNumber(attributes.creditTerm),
    signatureRequired: attributes.signatureRequired === true,

    preOrder: statusInput.preOrder,
    assembled: statusInput.assembled,
    isKaspiDelivery: statusInput.isKaspiDelivery,
    isExpress: delivery.express === true,
    isOrderArrived: null,
    returnedToWarehouse: delivery.returnedToWarehouse === true,
    deliveryMode: asString(attributes.deliveryMode),
    deliveryMethod: null,
    deliveryZone: null,
    cargoSpace: null,
    waybillNumber: statusInput.waybillNumber,
    firstMileCourier: asString(delivery.firstMileCourier),

    kaspiCustomerId: asString(customer.id),
    customerName: asString(customer.name),
    customerFirstName: asString(customer.firstName),
    customerLastName: asString(customer.lastName),
    customerPhone: asString(customer.cellPhone),

    deliveryCityId: null,
    deliveryTown: asString(address.town),
    deliveryDistrict: asString(address.district),
    deliveryStreetName: asString(address.streetName),
    deliveryStreetNumber: asString(address.streetNumber),
    deliveryBuilding: asString(address.building),
    deliveryApartment: asString(address.apartment),
    deliveryFloor: asString(address.floor),
    deliveryEntrance: asString(address.entranceNumber),
    deliveryIntercom: asString(address.intercomNumber),
    deliveryComment: asString(address.comment),
    deliveryIsPrivateHouse: asBoolean(address.isPrivateHouse),
    deliveryFormattedAddress: asString(address.formattedAddress),
    deliveryLatitude: asNumber(address.latitude),
    deliveryLongitude: asNumber(address.longitude),

    kaspiPickupPointId: asString(attributes.pickupPointId) ?? asString(origin.id),
    // `code` города — это КАТО, тот же справочник, что у складов.
    originCityId: asString(originCity.code),
    originCityName: asString(originCity.name),
    originFormattedAddress: asString(originAddress.formattedAddress),

    entriesCount: countEntries(raw.relationships),

    problems,
  };
}

/** Сколько позиций у заказа. Сами позиции приходят отдельным запросом. */
function countEntries(relationships: unknown): number {
  if (!isRecord(relationships)) return 0;

  const entries = isRecord(relationships.entries) ? relationships.entries : {};

  return Array.isArray(entries.data) ? entries.data.length : 0;
}

// Разбор JSON Kaspi — общий для заказа и его позиций (kaspi-order-entries.mapper).

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | null {
  if (typeof value === 'number') return String(value);

  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

export function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

/** Деньги строкой: number на цене теряет тиын и складывается с ошибкой. */
export function asMoney(value: unknown): string | null {
  const amount = asNumber(value);

  return amount === null ? null : amount.toFixed(2);
}

/**
 * Дата из Unix-миллисекунд в ISO.
 *
 * Ноль — это не 1970 год, а «значения нет»: Kaspi так обнуляет незаполненные
 * даты, и без этой проверки заказы уедут в прошлый век.
 */
function asDate(value: unknown): string | null {
  const ms = asNumber(value);

  if (ms === null || ms <= 0) return null;

  const date = new Date(ms);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
