import { LISTING_STATUSES, type CabinetOffer } from '@radeya/shared';

import type { RawCabinetOffer } from './kaspi-cabinet.client';

/**
 * Перевод товара из кабинета в наш вид.
 *
 * Правило одно: там, где данные допускают несколько толкований, запись
 * помечается проблемной, а не разбирается «как получится». Молча выбранное
 * наугад значение всплывёт ошибкой в цене или остатке, и найти его будет негде.
 */
export function toCabinetOffer(raw: RawCabinetOffer): CabinetOffer {
  const problems: string[] = [];

  const sku = asString(raw.sku);
  if (!sku) problems.push('Нет артикула');

  const prices = readPrices(raw, problems);
  const stock = readStock(raw);
  const images = asArray(raw.imagesV2);

  const familyId = asString(raw.familyId);

  return {
    sku: sku ?? '',
    masterSku: asString(raw.masterSku),
    offerId: asString(raw.offerId),

    // `title` и `model` — одна и та же строка, берём первую непустую.
    title: asString(raw.title) ?? asString(raw.model) ?? '',
    masterTitle: asString(raw.masterTitle),
    // brandName — наш бренд; поле brand содержит что-то другое, см. docs.
    brand: asString(raw.brandName) ?? asString(raw.brandCode),

    price: prices.price,
    discountPrice: prices.discountPrice,
    discountPercent: prices.discountPercent,

    barcode: readBarcode(raw),

    imageUrl: readFirstImage(images),
    imagesCount: images.length,

    status: readStatus(raw),

    warehouses: asArray(raw.points)
      .map(asString)
      .filter((code): code is string => code !== null),
    totalStock: stock.total,
    preOrderDays: stock.preOrderDays,

    categoryPath: readCategoryPath(raw),
    familyId,
    sizeCm: readSize(familyId, problems),

    shopLink: asString(raw.shopLink),
    updatedAt: asString(raw.updatedAt),

    problems,
  };
}

interface Prices {
  price: number | null;
  discountPrice: number | null;
  discountPercent: number;
}

/**
 * Цены берутся из `allCityPrices` — объекта на ~300 городов.
 *
 * Обычно во всех городах одно и то же. Если значения разошлись, единственной
 * цены у товара нет: берём первую, но помечаем запись — иначе разница между
 * городами потеряется без следа.
 */
function readPrices(raw: RawCabinetOffer, problems: string[]): Prices {
  const byCity = asRecord(raw.allCityPrices);
  const entries = byCity ? Object.values(byCity) : [];

  if (entries.length === 0) {
    // Запасной путь: цена верхнего уровня есть даже когда городов нет.
    const price = asNumber(raw.price);

    if (price === null) problems.push('Нет цены');

    return { price, discountPrice: null, discountPercent: 0 };
  }

  const variants = new Set<string>();
  let first: Prices | null = null;

  for (const entry of entries) {
    const city = asRecord(entry);
    if (!city) continue;

    const current = readCityPrice(city);

    variants.add(`${current.price}|${current.discountPrice}`);
    first ??= current;
  }

  if (variants.size > 1) {
    problems.push(`Цена различается по городам: ${variants.size} вариантов`);
  }

  return first ?? { price: null, discountPrice: null, discountPercent: 0 };
}

/**
 * У Kaspi `price` — то, по чему покупают, а `oldPrice` — зачёркнутая.
 * У нас зачёркнутая называется основной: она действующая, скидка считается от неё.
 */
function readCityPrice(city: Record<string, unknown>): Prices {
  const current = asNumber(city.price);
  const crossedOut = asNumber(city.oldPrice);
  const discount = asNumber(city.discount) ?? 0;

  if (crossedOut === null) {
    return { price: current, discountPrice: null, discountPercent: 0 };
  }

  return { price: crossedOut, discountPrice: current, discountPercent: discount };
}

interface Stock {
  total: number;
  preOrderDays: number;
}

/**
 * Остатки по складам.
 *
 * `stockCount: null` при `preOrder > 0` — это не ноль, а «под заказ за N дней».
 * В кабинете такой товар показан как «Остатки: Не указаны».
 */
function readStock(raw: RawCabinetOffer): Stock {
  let total = 0;
  let preOrderDays = 0;

  for (const item of asArray(raw.availabilities)) {
    const availability = asRecord(item);
    if (!availability) continue;

    total += asNumber(availability.stockCount) ?? 0;
    preOrderDays = Math.max(preOrderDays, asNumber(availability.preOrder) ?? 0);
  }

  return { total, preOrderDays };
}

/** Штрихкод — `ntin`. Весь объект может быть null: у части товаров его нет. */
function readBarcode(raw: RawCabinetOffer): string | null {
  const barcode = asRecord(raw.barcode);

  if (!barcode) return null;

  return asString(barcode.ntin) ?? asString(barcode.barcode);
}

function readFirstImage(images: unknown[]): string | null {
  const first = asRecord(images[0]);

  if (!first) return null;

  return asString(first.small) ?? asString(first.medium) ?? asString(first.large);
}

/** В ответе путь идёт от частного к общему — разворачиваем для показа. */
function readCategoryPath(raw: RawCabinetOffer): string[] {
  return asArray(raw.categoryPathCodes)
    .map(asString)
    .filter((code): code is string => code !== null)
    .reverse();
}

/** Архив определяем по данным, а не по режиму обхода: так надёжнее. */
function readStatus(raw: RawCabinetOffer) {
  const archived = raw.archivedAt !== null && raw.archivedAt !== undefined;

  return archived || raw.available === false
    ? LISTING_STATUSES.OFF_SALE
    : LISTING_STATUSES.ON_SALE;
}

/**
 * Размер в сантиметрах — скобка `familyId`, состоящая из одних цифр.
 *
 * По позиции искать нельзя: у дивана `{Соул}{диван}{прямой}{230}`,
 * у кровати `{Детская кровать}{Рони}{90}` — порядок разный.
 * Числовых скобок должно быть ровно одна, иначе непонятно, какая из них размер.
 */
function readSize(familyId: string | null, problems: string[]): number | null {
  if (!familyId) return null;

  const parts = [...familyId.matchAll(/\{([^}]*)\}/g)].map((match) => match[1] ?? '');
  const numbers = parts.filter((part) => /^\d+$/.test(part));

  if (numbers.length === 0) return null;

  if (numbers.length > 1) {
    problems.push(`В familyId несколько чисел: ${numbers.join(', ')}`);
    return null;
  }

  return Number(numbers[0]);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
