import { XMLParser } from 'fast-xml-parser';
import {
  LISTING_STATUSES,
  type KaspiCatalogOffer,
  type KaspiCatalogStock,
  type ListingStatus,
} from '@radeya/shared';

import { ValidationError } from '../../lib/errors';

/**
 * Разбор выгрузки каталога из кабинета Kaspi.
 *
 * Формат файла: kaspi_catalog → offers → offer, у каждого sku, model, brand,
 * список availability (склад, срок предзаказа, остаток) и список cityprice
 * (город, цена).
 *
 * Статус берётся не из файла, а из того, какой это файл: ACTIVE — в продаже,
 * ARCHIVE — снятые. Атрибут `available` внутри лишь дублирует это и используется
 * для сверки.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  // Эти узлы всегда массив, даже когда элемент один: иначе код развалится
  // на первом же товаре с двумя складами.
  isArray: (name) => ['offer', 'availability', 'cityprice'].includes(name),
  // Артикулы вроде 092811840 обязаны остаться строкой, иначе потеряют нули.
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
});

interface RawAvailability {
  '@available'?: string;
  '@storeId'?: string;
  '@preOrder'?: string;
  '@stockCount'?: string;
}

interface RawOffer {
  '@sku'?: string;
  model?: string;
  brand?: string;
  price?: string;
  availabilities?: { availability?: RawAvailability[] } | string;
  cityprices?: { cityprice?: RawCityPrice[] } | string;
}

interface RawCityPrice {
  '@cityId'?: string;
  '#text'?: string;
}

export function parseKaspiCatalog(
  xml: string,
  status: ListingStatus,
): KaspiCatalogOffer[] {
  let document: unknown;

  try {
    document = parser.parse(xml);
  } catch {
    throw new ValidationError('Файл не является корректным XML');
  }

  const rawOffers = extractOffers(document);

  if (rawOffers === null) {
    throw new ValidationError(
      'В файле нет узла kaspi_catalog → offers. Это не выгрузка каталога Kaspi',
    );
  }

  return rawOffers.map((offer) => mapOffer(offer, status));
}

function extractOffers(document: unknown): RawOffer[] | null {
  const catalog = (document as Record<string, unknown> | null)?.[
    'kaspi_catalog'
  ] as Record<string, unknown> | undefined;

  if (!catalog) return null;

  const offers = catalog.offers as { offer?: RawOffer[] } | string | undefined;

  if (offers === undefined) return null;
  // <offers/> без товаров разбирается в пустую строку — это валидный пустой файл.
  if (typeof offers === 'string') return [];

  return offers.offer ?? [];
}

function mapOffer(raw: RawOffer, status: ListingStatus): KaspiCatalogOffer {
  const problems: string[] = [];

  const sku = (raw['@sku'] ?? '').trim();
  if (!sku) problems.push('Нет артикула');

  const rawModel = typeof raw.model === 'string' ? raw.model.trim() : '';
  if (!rawModel) problems.push('Пустое название');

  const { name, subtitle } = splitModel(rawModel);

  const availabilities = toArray(raw.availabilities, 'availability');
  const cityPrices = toArray(raw.cityprices, 'cityprice');

  const stocks = buildStocks(availabilities, cityPrices, raw, problems, status);

  if (availabilities.length === 0) problems.push('Нет складов');

  const totalStock = stocks.reduce((sum, item) => sum + (item.stockCount ?? 0), 0);
  const prices = stocks
    .map((item) => item.price)
    .filter((value): value is number => value !== null);

  return {
    sku,
    brand: typeof raw.brand === 'string' && raw.brand ? raw.brand : null,
    rawModel,
    name,
    subtitle,
    status,
    stocks,
    totalStock,
    // Под заказ, если наличия нет нигде, но срок предзаказа указан.
    isPreOrder:
      totalStock === 0 && stocks.some((item) => item.preOrderDays > 0),
    price: prices.length > 0 ? Math.min(...prices) : null,
    problems,
  };
}

/**
 * Название и подназвание из одной строки <model>.
 * Правило простое — до первой запятой и после неё. Товары без запятой
 * («Порту») остаются с пустым подназванием, это не ошибка.
 */
function splitModel(model: string): { name: string; subtitle: string | null } {
  const comma = model.indexOf(',');

  if (comma === -1) return { name: model, subtitle: null };

  return {
    name: model.slice(0, comma).trim(),
    subtitle: model.slice(comma + 1).trim() || null,
  };
}

/**
 * Склады и цены.
 *
 * availability и cityprice — два независимых списка, связи между ними в файле нет.
 * Наблюдение по реальной выгрузке: они идут в одном порядке и один склад
 * соответствует одному городу. Поэтому сопоставляем по позиции, а когда длины
 * не совпадают — не выдумываем, а отмечаем проблему.
 */
function buildStocks(
  availabilities: RawAvailability[],
  cityPrices: RawCityPrice[],
  raw: RawOffer,
  problems: string[],
  status: ListingStatus,
): KaspiCatalogStock[] {
  const singlePrice = cityPrices.length === 1 ? readPrice(cityPrices[0]) : null;
  // Запасной путь: у части снятых товаров вместо cityprices стоит <price>.
  const flatPrice = raw.price !== undefined ? toNumber(raw.price) : null;

  if (
    cityPrices.length > 0 &&
    availabilities.length > 0 &&
    cityPrices.length !== availabilities.length
  ) {
    problems.push('Число складов и цен не совпадает — цены сопоставлены неточно');
  }

  return availabilities.map((availability, index) => {
    const storeId = (availability['@storeId'] ?? '').trim();
    const cityPrice = cityPrices[index];

    if (!storeId) problems.push('У склада нет storeId');

    if (
      availability['@available'] === 'yes' &&
      status === LISTING_STATUSES.OFF_SALE
    ) {
      problems.push('Товар в архиве, но помечен как доступный');
    }

    return {
      storeId,
      warehouseCode: warehouseCodeFrom(storeId),
      cityId: cityPrice?.['@cityId'] ?? null,
      price: readPrice(cityPrice) ?? singlePrice ?? flatPrice,
      stockCount: toNumber(availability['@stockCount']),
      preOrderDays: toNumber(availability['@preOrder']) ?? 0,
    };
  });
}

/** `6871008_PP3` → `PP3`. Идентификатор продавца в коде склада не нужен. */
function warehouseCodeFrom(storeId: string): string {
  const separator = storeId.lastIndexOf('_');

  return separator === -1 ? storeId : storeId.slice(separator + 1);
}

function readPrice(cityPrice: RawCityPrice | undefined): number | null {
  if (!cityPrice) return null;

  return toNumber(cityPrice['#text']);
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined || value === '') return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function toArray<T>(
  container: { [key: string]: unknown } | string | undefined,
  key: string,
): T[] {
  // <availabilities/> без детей разбирается в пустую строку.
  if (!container || typeof container === 'string') return [];

  return (container[key] as T[] | undefined) ?? [];
}
