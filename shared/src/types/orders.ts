import type { CatalogPageSize } from '../constants/catalog';
import type { KaspiOrderPeriod } from '../constants/kaspi-orders';
import type { OrderDeliveryType, OrderStatus } from '../constants/order-statuses';
import type { PaginatedResponse } from './api';

/**
 * Заказ Kaspi, разобранный в нашу модель.
 *
 * Имена полей совпадают с моделью `Order` в schema.prisma: когда дойдём
 * до записи, сохранение станет прямым переносом, без второго словаря имён.
 *
 * Деньги — строками с двумя знаками: number на цене теряет тиын.
 * Даты — ISO-строками: Kaspi отдаёт Unix-миллисекунды, но JSON времени не знает.
 *
 * Поля, помеченные «только кабинет», по токену не приходят и всегда null.
 * Они есть в черновике, чтобы форма совпадала с моделью.
 */
export interface KaspiOrderDraft {
  kaspiId: string | null;
  code: string;

  status: OrderStatus;
  deliveryType: OrderDeliveryType;
  kaspiStatus: string;
  kaspiState: string | null;

  cancellationReason: string | null;
  /** Только кабинет. */
  cancelReason: string | null;
  cancelSubReason: string | null;
  moderated: boolean | null;
  moderatedReason: string | null;
  moderatedSubReason: string | null;

  createdAtKaspi: string;
  /** Только кабинет. */
  updatedAtKaspi: string | null;
  approvedByBankAt: string | null;
  completedAt: string | null;
  /** Только кабинет. */
  assembledAt: string | null;
  courierTransmissionAt: string | null;
  courierTransmissionPlannedAt: string | null;
  plannedDeliveryAt: string | null;
  /** Только кабинет. */
  actualDeliveryAt: string | null;
  returnedToWarehouseAt: string | null;
  returnedToWarehouseTimeoutAt: string | null;

  totalPrice: string;
  deliveryCost: string | null;
  deliveryCostForSeller: string | null;
  /** Только кабинет: сумма рассрочки с наценкой банка. */
  loanAmount: string | null;
  paymentMode: string | null;
  creditTerm: number | null;
  signatureRequired: boolean;

  preOrder: boolean;
  assembled: boolean;
  isKaspiDelivery: boolean;
  isExpress: boolean;
  /** Только кабинет. */
  isOrderArrived: boolean | null;
  returnedToWarehouse: boolean;
  deliveryMode: string | null;
  /** Только кабинет. */
  deliveryMethod: string | null;
  deliveryZone: string | null;
  cargoSpace: number | null;
  waybillNumber: string | null;
  firstMileCourier: string | null;

  kaspiCustomerId: string | null;
  customerName: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  /** У архивных заказов Kaspi отдаёт маску `+0(000)-000-00-00`. */
  customerPhone: string | null;

  deliveryCityId: string | null;
  deliveryTown: string | null;
  deliveryDistrict: string | null;
  deliveryStreetName: string | null;
  deliveryStreetNumber: string | null;
  deliveryBuilding: string | null;
  deliveryApartment: string | null;
  deliveryFloor: string | null;
  deliveryEntrance: string | null;
  deliveryIntercom: string | null;
  deliveryComment: string | null;
  deliveryIsPrivateHouse: boolean | null;
  deliveryFormattedAddress: string | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;

  /** Идентификатор точки как прислал Kaspi: `6871008_PP27`. */
  kaspiPickupPointId: string | null;
  originCityId: string | null;
  originCityName: string | null;
  originFormattedAddress: string | null;

  /** Сколько позиций обещает Kaspi. Сами позиции приходят отдельным запросом. */
  entriesCount: number;

  /** Что не удалось разобрать. Пустой массив — запись в порядке. */
  problems: string[];
}

/**
 * Сколько раз встретилось каждое значение.
 *
 * Нужна, чтобы видеть, какие статусы Kaspi реально существуют: полного
 * перечня площадка не публикует, и единственный надёжный источник —
 * сами данные за длинный период.
 */
export type ValueCounts = Record<string, number>;

export interface KaspiOrdersPreview {
  /** `meta` Kaspi как есть: totalCount, pageCount, pageNumber, pageSize. */
  meta: unknown;
  count: number;
  orders: KaspiOrderDraft[];
  /** Первый заказ сырым и разобранным рядом — сверка маппинга глазами. */
  sample: { raw: unknown; mapped: KaspiOrderDraft } | null;
  /**
   * Все заказы страницы сырыми, как их прислал Kaspi. Приходят только
   * по `?raw=1`: ответ с ними вдвое тяжелее, а нужны они лишь при разборе
   * расхождений со складом.
   */
  rawOrders?: unknown[];
  /** Сколько записей разобрались не полностью. */
  withProblems: number;

  /** Что встретилось на этой странице: значения Kaspi и наши после разбора. */
  seen: {
    kaspiStatuses: ValueCounts;
    kaspiStates: ValueCounts;
    deliveryModes: ValueCounts;
    statuses: ValueCounts;
    deliveryTypes: ValueCounts;
  };

  /** Значения Kaspi, которых нет в нашем списке известных. Пусто — все знакомы. */
  unknownValues: string[];
}

/**
 * Список заказов из нашей базы.
 *
 * Размеры страниц те же, что у каталога (`CatalogPageSize`): таблица общая,
 * и два разных набора размеров сбивали бы с толку без всякой пользы.
 */
export interface OrderListQuery {
  page?: number;
  pageSize?: CatalogPageSize;
  /** Поиск по номеру заказа. */
  search?: string;
  /**
   * Период по дате заказа у Kaspi, ISO-время включительно.
   *
   * Именно время, а не `YYYY-MM-DD`: границы суток зависят от часового пояса,
   * и «за 21 сентября» в Алматы и в UTC — разные наборы заказов. Клиент
   * переводит выбранные даты в границы своих суток, сервер сравнивает как есть.
   */
  from?: string;
  to?: string;
}

/** Строка списка заказов. Только то, что видно в таблице. */
export interface OrderRowDto {
  id: string;
  code: string;
  status: OrderStatus;
  deliveryType: OrderDeliveryType;
  /** Статус площадки как есть — рядом с нашим, чтобы видеть расхождение. */
  kaspiStatus: string;
  createdAtKaspi: string;
  /**
   * Когда Kaspi обещает доставить заказ клиенту. Пусто у отменённых и у тех,
   * где площадка срок ещё не назначила.
   */
  plannedDeliveryAt: string | null;
  /** Точное десятичное значение в тенге, например "259900.00". */
  totalPrice: string;
  /**
   * Три поля, а не одно: `name` у Kaspi — это **только имя**, фамилия лежит
   * отдельно и обычно одной буквой («Аскарбек» + «А»). Показывать их вместе
   * или порознь — решает интерфейс.
   */
  customerName: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerPhone: string | null;
  deliveryTown: string | null;
  preOrder: boolean;
  /** Склад отгрузки. null — Kaspi назвал точку, которой нет в справочнике. */
  warehouse: { code: string; name: string | null } | null;
  /** Сколько позиций сохранено. Ноль — состав ещё не тянули. */
  entriesCount: number;
}

export interface OrderListResponse extends PaginatedResponse<OrderRowDto> {
  totalPages: number;
}

/**
 * Шаг синхронизации заказов.
 *
 * Синхронизация возобновляемая: вызов обрабатывает пачку трёхдневных отрезков
 * и возвращает курсор, клиент повторяет, пока не придёт `done`. Иначе два года
 * (244 отрезка) не уложились бы ни в один разумный таймаут.
 */
export interface SyncKaspiOrdersRequest {
  period: KaspiOrderPeriod;
  /**
   * Граница, с которой продолжать: ISO-время правого края следующего отрезка.
   * Пусто — начать с текущего момента и идти в прошлое.
   */
  cursor?: string;
  /** Сколько отрезков обработать за этот вызов. */
  maxChunks?: number;
}

export interface SyncKaspiOrdersResponse {
  period: KaspiOrderPeriod;
  /** Границы всего периода, ISO. */
  from: string;
  to: string;

  /** Весь период кончился — повторять вызов не нужно. */
  done: boolean;
  /** Что передать в `cursor` следующим вызовом. null — `done`. */
  nextCursor: string | null;

  /** Сколько отрезков в периоде всего и сколько пройдено к этому моменту. */
  chunksTotal: number;
  chunksDone: number;

  /** Счётчики этого вызова, а не всего периода: итог складывает клиент. */
  pages: number;
  ordersSeen: number;
  created: number;
  updated: number;
  /** Заказы, которые не удалось сохранить: нет номера или даты создания. */
  skipped: number;
  withProblems: number;
  /** Незнакомые значения Kaspi, встреченные на этом шаге. */
  unknownValues: string[];
  /** Склады Kaspi, которых нет в нашем справочнике. */
  unknownWarehouses: string[];
  tookMs: number;
}
