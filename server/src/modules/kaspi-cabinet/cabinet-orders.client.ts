import { env } from '../../config/env';
import { AppError, ValidationError } from '../../lib/errors';
import { isRecord } from '../orders/kaspi-orders.mapper';
import { CABINET_ORIGIN, cabinetPostJson } from './cabinet-http';

/**
 * Заказ из кабинета Kaspi — GraphQL `getOrderDetails`, тот же запрос, что
 * шлёт страница заказа в кабинете (снят пользователем из DevTools 01.10.2026).
 *
 * Нужен ради полей, которых нет в Shop API: прежде всего «Планируемая дата
 * прибытия» (`delivery.plannedPointDeliveryDate`). Вызывать через
 * withCabinetSession() — сессию и повторный вход берёт на себя она.
 */

const GRAPHQL_URL = `${CABINET_ORIGIN}/mc/facade/graphql?opName=getOrderDetails`;

/**
 * Текст запроса — **слово в слово** как у кабинета. Внутренний API может
 * принимать только знакомые запросы; урезанный рискует получить отказ,
 * а сломается это молча при очередном обновлении кабинета. Поменяет Kaspi
 * запрос у себя — снять заново из DevTools (Payload → view source).
 *
 * Телефоны покупателя отключаются переменной `skipCustomerPhone` — штатным
 * переключателем самого запроса: они у нас уже есть из Shop API.
 * Ответ целиком ложится в `Order.rawCabinet`.
 */
const ORDER_DETAILS_QUERY = 'query getOrderDetails($merchantUid: String!, $orderCode: String!, $skipCustomerPhone: Boolean! = false) {\n  merchant(id: $merchantUid) {\n    orderDetail(code: $orderCode) {\n      code\n      cancelReason\n      cancelSubReason\n      moderated\n      moderatedReason\n      moderatedSubReason\n      buyerContactAlias {\n        phoneAlias\n        trustedPhoneAlias\n        __typename\n      }\n      checkoutSmsRequired\n      commentText\n      courierDetails {\n        ext\n        phone\n        __typename\n      }\n      consignments {\n        returnedWarehouse {\n          address\n          __typename\n        }\n        trackingMapUrl\n        superExpressStatus\n        __typename\n      }\n      creationTime\n      customer {\n        phoneNumber @skip(if: $skipCustomerPhone)\n        lastName\n        firstName\n        __typename\n      }\n      recipient {\n        phoneNumber @skip(if: $skipCustomerPhone)\n        lastName\n        firstName\n        __typename\n      }\n      delivery {\n        transmissionPlanningDate\n        returnedToWareHouseTimeoutDate\n        plannedDeliveryDate\n        mode\n        kdAssembled\n        kdTransmittedToCourier\n        kdReturnedToWarehouseDate\n        isReturnedToWarehouse\n        isExpress\n        isOrderArrived\n        assembleDate\n        actualDeliveryDate\n        plannedPointDeliveryDate\n        __typename\n      }\n      deliveryCost\n      deliveryDiscount\n      deliverySubsidyCost\n      destination {\n        ... on Postomat {\n          id\n          city {\n            name\n            __typename\n          }\n          postomatAddress: address\n          __typename\n        }\n        ... on OrderAddress {\n          streetNumber\n          building\n          streetName\n          apartment\n          entranceNumber\n          floor\n          intercomNumber\n          comment\n          city {\n            name\n            __typename\n          }\n          __typename\n        }\n        ... on Point {\n          kaspiDelivery {\n            dailyMaxPickupTimeEnabled\n            __typename\n          }\n          city {\n            name\n            __typename\n          }\n          pointAddress: address {\n            streetNumber\n            streetName\n            building\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      entries {\n        weight\n        unit\n        unitMeasurement\n        totalPrice\n        quantity\n        product {\n          name\n          images {\n            baseUrl\n            paths\n            __typename\n          }\n          code\n          __typename\n        }\n        merchantProduct {\n          barcode\n          name\n          code\n          __typename\n        }\n        isImeiRequired\n        entryId\n        __typename\n      }\n      kaspiDelivery\n      markers {\n        marker\n        creationTime\n        __typename\n      }\n      modificationTime\n      payments {\n        ... on OrderLoan {\n          __typename\n          signRequired\n        }\n        ... on OrderAccount {\n          signRequired\n          account\n          __typename\n        }\n        __typename\n      }\n      reservedUntilDate\n      returnRequests {\n        code\n        completionTime\n        entries {\n          productCode\n          receivedQuantity\n          __typename\n        }\n        internalCode\n        status\n        __typename\n      }\n      state\n      status\n      orderSteps {\n        __typename\n        ... on SimpleOrderStep {\n          actualTime\n          step\n          plannedTime\n          timeoutTime\n          __typename\n        }\n        ... on RangeOrderStep {\n          step\n          from\n          to\n          __typename\n        }\n      }\n      preOrder\n      totalPrice\n      warehouse {\n        ... on Postomat {\n          city {\n            id\n            name\n            __typename\n          }\n          postomatAddress: address\n          __typename\n        }\n        ... on OrderAddress {\n          streetNumber\n          building\n          streetName\n          city {\n            name\n            id\n            __typename\n          }\n          __typename\n        }\n        ... on Point {\n          name\n          kaspiDelivery {\n            pickupType\n            __typename\n          }\n          city {\n            name\n            id\n            __typename\n          }\n          pointAddress: address {\n            streetNumber\n            streetName\n            building\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}';

export interface CabinetOrderDetail {
  /** `orderDetail` как пришёл — для `Order.rawCabinet`. */
  raw: Record<string, unknown>;
  /** Пусто — у заказа даты нет (например, самовывоз или уже доставлен). */
  plannedPointDeliveryAt: Date | null;
}

/**
 * Заказ по номеру. null — кабинет такого заказа не знает.
 * Не пустил — AppError KASPI_UNAUTHORIZED (из cabinetPostJson).
 */
export async function fetchCabinetOrderDetail(
  orderCode: string,
  cookie: string,
): Promise<CabinetOrderDetail | null> {
  const merchantUid = env.KASPI_MERCHANT_ID;

  if (!merchantUid) {
    throw new ValidationError('Не задан KASPI_MERCHANT_ID в .env — заказ из кабинета не запросить');
  }

  const body = await cabinetPostJson(GRAPHQL_URL, cookie, {
    operationName: 'getOrderDetails',
    variables: { skipCustomerPhone: true, merchantUid, orderCode },
    query: ORDER_DETAILS_QUERY,
  });

  if (!isRecord(body)) throw badResponse('ответ не объект');

  // GraphQL отвечает 200 и при ошибке — она лежит в `errors`, а не в коде ответа.
  if (Array.isArray(body.errors) && body.errors.length > 0) {
    const first = body.errors[0];
    const message = isRecord(first) && typeof first.message === 'string' ? first.message : 'без текста';

    throw new AppError(502, 'KASPI_GRAPHQL_ERROR', `Кабинет Kaspi вернул ошибку: ${message}`);
  }

  const data = isRecord(body.data) ? body.data : null;
  const merchant = data && isRecord(data.merchant) ? data.merchant : null;

  if (merchant === null) throw badResponse('нет data.merchant');

  const detail = merchant.orderDetail;

  if (detail === null || detail === undefined) return null;
  if (!isRecord(detail)) throw badResponse('orderDetail не объект');

  const delivery = isRecord(detail.delivery) ? detail.delivery : null;

  return { raw: detail, plannedPointDeliveryAt: readDate(delivery?.plannedPointDeliveryDate) };
}

/** ISO-строка из кабинета в дату. Не строка или не дата — пусто, а не «сейчас». */
function readDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value === '') return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function badResponse(reason: string): AppError {
  return new AppError(502, 'KASPI_BAD_RESPONSE', `Кабинет Kaspi ответил не тем: ${reason}`);
}
