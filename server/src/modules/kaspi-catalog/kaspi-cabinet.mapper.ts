import {
  LISTING_STATUSES,
  type CabinetDelivery,
  type CabinetImage,
  type CabinetOffer,
  type CabinetStock,
} from '@radeya/shared';

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
  const availabilities = readAvailabilities(raw);
  const stock = readStock(raw);
  const rawImages = asArray(raw.imagesV2);
  const images = readImages(rawImages);

  const familyId = asString(raw.familyId);

  return {
    sku: sku ?? '',
    masterSku: asString(raw.masterSku),
    offerId: asString(raw.offerId),

    // `title` и `model` — обычно одна и та же строка, берём первую непустую.
    title: asString(raw.title) ?? asString(raw.model) ?? '',
    masterTitle: asString(raw.masterTitle),
    model: asString(raw.model),
    // brandName — наш бренд; поле brand содержит что-то другое, см. docs.
    brand: asString(raw.brandName) ?? asString(raw.brandCode),

    fileId: asString(raw.fileId),
    merchantUid: asString(raw.merchantUid),

    price: prices.price,
    discountPrice: prices.discountPrice,
    discountPercent: prices.discountPercent,

    barcode: readBarcode(raw),

    imageUrl: images[0]?.small ?? images[0]?.medium ?? images[0]?.large ?? null,
    imagesCount: images.length,
    images,

    status: readStatus(raw),

    delivery: readDelivery(raw),

    warehouses: asArray(raw.points)
      .map(asString)
      .filter((code): code is string => code !== null),
    stocks: toStocks(availabilities),
    totalStock: stock.total,
    preOrderDays: stock.preOrderDays,

    categoryPath: readCategoryPath(raw),
    familyId,
    sizeCm: readSize(familyId, problems),

    shopLink: asString(raw.shopLink),
    updatedAt: asString(raw.updatedAt),

    updates: asArray(raw.updates),

    problems,
  };
}

/**
 * Флаги доставки кабинета.
 *
 * Отсутствующий флаг — это `false`, а не «неизвестно»: в кабинете выключенный
 * способ доставки поля может не прислать вовсе, и трактовать это как включённый
 * нельзя — товар уедет покупателю способом, которым мы его не возим.
 */
function readDelivery(raw: RawCabinetOffer): CabinetDelivery {
  return {
    any: raw.anyKaspiDelivery === true,
    express: raw.anyKaspiDeliveryExpress === true,
    local: raw.anyKaspiDeliveryLocal === true,
    merchant: raw.anyMerchantDelivery === true,
  };
}

/** Картинки карточки: три размера на каждую, адреса готовые — файлы не качаем. */
function readImages(rawImages: unknown[]): CabinetImage[] {
  const images: CabinetImage[] = [];

  for (const item of rawImages) {
    const image = asRecord(item);
    if (!image) continue;

    const small = asString(image.small);
    const medium = asString(image.medium);
    const large = asString(image.large);

    // Запись без единого адреса бесполезна: показывать нечего и хранить нечего.
    if (small === null && medium === null && large === null) continue;

    images.push({ small, medium, large });
  }

  return images;
}

/** Наличие по складам в виде, пригодном для сохранения: без записей без склада. */
function toStocks(availabilities: CabinetAvailability[]): CabinetStock[] {
  const stocks: CabinetStock[] = [];

  for (const availability of availabilities) {
    const { code, storeId } = availability;

    if (code === null || storeId === null) continue;

    stocks.push({
      warehouseCode: code,
      storeId,
      quantity: availability.stockCount,
      preOrderDays: availability.preOrderDays,
    });
  }

  return stocks;
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

/** Строка наличия: остаток товара на одном складе. */
export interface CabinetAvailability {
  /** Идентификатор в Kaspi: `6871008_PP3`. Пусто — склад в записи не назван. */
  storeId: string | null;
  /** Наш короткий код: `PP3`. Хвост `storeId`, а не отдельное поле ответа. */
  code: string | null;
  /** Пусто — остаток не указан, товар под заказ. Ноль и «неизвестно» — разное. */
  stockCount: number | null;
  /** Срок предзаказа в днях. 0 — товар в наличии. */
  preOrderDays: number;
}

/**
 * Наличие по складам.
 *
 * Разбор `availabilities` живёт здесь один раз: по нему считается и остаток
 * товара, и сводка складов за обход. Записи без узнаваемого `storeId` остаются
 * в списке — остаток по ним реальный, и терять его из суммы нельзя; в справочник
 * складов такую строку не возьмут, там нужен идентификатор.
 */
export function readAvailabilities(raw: RawCabinetOffer): CabinetAvailability[] {
  const result: CabinetAvailability[] = [];

  for (const item of asArray(raw.availabilities)) {
    const availability = asRecord(item);
    if (!availability) continue;

    const storeId = asString(availability.storeId);

    result.push({
      storeId,
      code: storeId === null ? null : readWarehouseCode(storeId),
      stockCount: asNumber(availability.stockCount),
      preOrderDays: asNumber(availability.preOrder) ?? 0,
    });
  }

  return result;
}

/** `6871008_PP3` → `PP3`. Всё, что не этой формы, складом не считаем. */
function readWarehouseCode(storeId: string): string | null {
  const match = /^\d+_(PP\d+)$/.exec(storeId);

  return match?.[1] ?? null;
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

  for (const availability of readAvailabilities(raw)) {
    total += availability.stockCount ?? 0;
    preOrderDays = Math.max(preOrderDays, availability.preOrderDays);
  }

  return { total, preOrderDays };
}

/** Штрихкод — `ntin`. Весь объект может быть null: у части товаров его нет. */
function readBarcode(raw: RawCabinetOffer): string | null {
  const barcode = asRecord(raw.barcode);

  if (!barcode) return null;

  return asString(barcode.ntin) ?? asString(barcode.barcode);
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
