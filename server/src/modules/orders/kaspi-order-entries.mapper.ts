import { asMoney, asNumber, asString, isRecord } from './kaspi-orders.mapper';

/**
 * Позиция заказа Kaspi в нашу модель — раздел 2.2 интеграции.
 *
 * `attributes`: entryNumber, quantity, basePrice, totalPrice, deliveryCost,
 * category { code, title }, offer { code, name }. `offer.code` — наш артикул,
 * по нему позиция связывается с каталогом. Товар карточки Kaspi — в
 * `relationships.product.data.id`.
 */
export interface KaspiEntryDraft {
  entryNumber: number;
  /** Идентификатор позиции у Kaspi: `1055815957##0`. */
  kaspiEntryId: string | null;
  sku: string | null;
  offerName: string | null;
  kaspiProductCode: string | null;
  quantity: number;
  basePrice: string | null;
  totalPrice: string | null;
  deliveryCost: string | null;
  categoryCode: string | null;
  categoryTitle: string | null;
}

/**
 * null — позиция без номера: сохранить её нельзя, ключ повторной загрузки —
 * пара «заказ + номер позиции».
 */
export function toEntryDraft(raw: unknown): KaspiEntryDraft | null {
  if (!isRecord(raw)) return null;

  const attributes = isRecord(raw.attributes) ? raw.attributes : {};
  const entryNumber = asNumber(attributes.entryNumber);

  if (entryNumber === null || !Number.isInteger(entryNumber)) return null;

  const offer = isRecord(attributes.offer) ? attributes.offer : {};
  const category = isRecord(attributes.category) ? attributes.category : {};
  const relationships = isRecord(raw.relationships) ? raw.relationships : {};
  const product = isRecord(relationships.product) ? relationships.product : {};
  const productData = isRecord(product.data) ? product.data : {};
  const quantity = asNumber(attributes.quantity);

  return {
    entryNumber,
    kaspiEntryId: asString(raw.id),
    sku: asString(offer.code),
    offerName: asString(offer.name),
    kaspiProductCode: asString(productData.id),
    // Количества нет — значит одна штука: так Kaspi и считает позицию.
    quantity: quantity !== null && Number.isInteger(quantity) && quantity > 0 ? quantity : 1,
    basePrice: asMoney(attributes.basePrice),
    totalPrice: asMoney(attributes.totalPrice),
    deliveryCost: asMoney(attributes.deliveryCost),
    categoryCode: asString(category.code),
    categoryTitle: asString(category.title),
  };
}
