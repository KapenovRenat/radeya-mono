import type { KaspiCabinetFetchResponse } from '@radeya/shared';

import { env } from '../../config/env';
import { AppError, ValidationError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { fetchOffersPage, type RawCabinetOffer } from './kaspi-cabinet.client';
import { toCabinetOffer } from './kaspi-cabinet.mapper';
import { getStoredCookie, hasStoredCookie, rememberCookie } from './kaspi-cabinet.session';

/**
 * Обход каталога кабинета Kaspi.
 *
 * Пока задача одна — получить данные и показать их в консоли сервера.
 * Разбор в наши модели и таблица на странице появятся следующим шагом,
 * в базу не пишется ничего.
 */

/** Сколько товаров просим за раз. Проверено: кабинет отдаёт ровно столько. */
const PAGE_SIZE = 100;

/** Пауза между обращениями: частые запросы приводят к блокировке по IP. */
const PAUSE_BETWEEN_PAGES_MS = 500;

/** Страховка от бесконечного цикла, если кабинет перестанет листать. */
const MAX_PAGES = 500;

export interface FetchCatalogInput {
  cookie?: string;
  remember?: boolean;
}

export async function fetchCabinetCatalog(
  input: FetchCatalogInput,
): Promise<KaspiCabinetFetchResponse> {
  const merchantId = env.KASPI_MERCHANT_ID;

  if (!merchantId) {
    throw new ValidationError(
      'Не задан KASPI_MERCHANT_ID в .env — без него неизвестно, чей каталог запрашивать',
    );
  }

  const cookie = resolveCookie(input);

  if (input.remember) rememberCookie(cookie);

  // Два режима: в продаже и архив. Статус товара определяется тем, в каком
  // обходе он пришёл, — как и с файлами ACTIVE.xml / ARCHIVE.xml.
  const onSale = await crawl({ merchantId, cookie, onSale: true });
  const offSale = await crawl({ merchantId, cookie, onSale: false });

  logSample(onSale.offers[0] ?? offSale.offers[0]);

  const offers = [...onSale.offers, ...offSale.offers].map(toCabinetOffer);
  const total = offers.length;
  const withProblems = offers.filter((offer) => offer.problems.length > 0).length;
  const expected = sumExpected(onSale.expected, offSale.expected);

  logger.info(
    `Kaspi: обход завершён — в продаже ${onSale.offers.length}, архив ${offSale.offers.length}, всего ${total}, с проблемами ${withProblems}`,
  );

  if (expected !== null && expected !== total) {
    logger.warn(`Kaspi: кабинет обещал ${expected} товаров, получено ${total}`);
  }

  const stopped = onSale.stoppedAtPage !== null ? onSale : offSale;

  return {
    total,
    onSale: onSale.offers.length,
    offSale: offSale.offers.length,
    expected,
    pages: onSale.pages + offSale.pages,
    stoppedAtPage: stopped.stoppedAtPage,
    stoppedReason: stopped.stoppedReason,
    hasStoredCookie: hasStoredCookie(),
    withProblems,
    offers,
  };
}

interface CrawlParams {
  merchantId: string;
  cookie: string;
  onSale: boolean;
}

interface CrawlResult {
  offers: RawCabinetOffer[];
  /** Сколько товаров обещал кабинет в этом режиме. */
  expected: number | null;
  pages: number;
  stoppedAtPage: number | null;
  stoppedReason: string | null;
}

/** Обход всех страниц одного режима — либо «в продаже», либо архив. */
async function crawl(params: CrawlParams): Promise<CrawlResult> {
  const label = params.onSale ? 'в продаже' : 'архив';
  const offers: RawCabinetOffer[] = [];
  const seenOfferIds = new Set<string>();

  let page = 0;
  let expected: number | null = null;
  let stoppedAtPage: number | null = null;
  let stoppedReason: string | null = null;

  logger.info(`Kaspi: обход «${label}»`);

  while (page < MAX_PAGES) {
    let batch;

    try {
      batch = await fetchOffersPage({
        merchantId: params.merchantId,
        cookie: params.cookie,
        page,
        pageSize: PAGE_SIZE,
        onSale: params.onSale,
      });
    } catch (error) {
      // Обрыв на середине — не повод терять уже полученное. Отдаём частичный
      // результат и говорим, с какой страницы продолжать со свежей кукой.
      stoppedAtPage = page;
      stoppedReason = error instanceof AppError ? error.message : 'неизвестная ошибка';

      logger.error(`Kaspi: «${label}» прерван на странице ${page}`, stoppedReason);
      break;
    }

    expected ??= batch.total;

    if (batch.offers.length === 0) break;

    const newOnPage = collectNew(batch.offers, seenOfferIds, offers);

    logger.info(
      `Kaspi: «${label}» страница ${page} — получено ${batch.offers.length}, новых ${newOnPage}, всего ${offers.length}${
        expected === null ? '' : ` из ${expected}`
      }`,
    );

    // Кабинет проигнорировал номер страницы и вернул то же самое.
    // Продолжать бессмысленно: будем крутиться по одной странице до предела.
    if (newOnPage === 0) {
      stoppedAtPage = page;
      stoppedReason = 'Кабинет вернул страницу без новых товаров — листание не работает';
      logger.warn(`Kaspi: ${stoppedReason}`);
      break;
    }

    page += 1;

    // Всё обещанное уже получено — дальше кабинет отдаст пустую страницу,
    // а лишнее обращение приближает блокировку по IP.
    if (expected !== null && offers.length >= expected) break;

    await pause(PAUSE_BETWEEN_PAGES_MS);
  }

  return { offers, expected, pages: page, stoppedAtPage, stoppedReason };
}

/** Кука из запроса важнее запомненной: её вставили только что, значит она свежее. */
function resolveCookie(input: FetchCatalogInput): string {
  const cookie = input.cookie?.trim() || getStoredCookie();

  if (!cookie) {
    throw new ValidationError(
      'Нужна кука сессии кабинета: вставьте её в поле — запомненной сейчас нет',
    );
  }

  return cookie;
}

/** Сумма обещанных количеств. Null, если кабинет не прислал его ни разу. */
function sumExpected(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;

  return (a ?? 0) + (b ?? 0);
}

/**
 * Добавляет в общий список товары, которых там ещё не было.
 * Возвращает, сколько оказалось новых — по этому числу видно, листает кабинет или нет.
 */
function collectNew(
  batch: RawCabinetOffer[],
  seen: Set<string>,
  target: RawCabinetOffer[],
): number {
  let added = 0;

  for (const offer of batch) {
    const id = typeof offer.offerId === 'string' ? offer.offerId : null;

    // Без идентификатора отличить повтор нельзя — берём как есть, пусть попадёт в разбор.
    if (id === null) {
      target.push(offer);
      added += 1;
      continue;
    }

    if (seen.has(id)) continue;

    seen.add(id);
    target.push(offer);
    added += 1;
  }

  return added;
}

/**
 * Один товар в консоль — чтобы глазами увидеть, что пришло.
 *
 * `allCityPrices` сворачиваем: там около трёхсот городов, и в консоли
 * они прячут все остальные поля.
 */
function logSample(first: RawCabinetOffer | undefined): void {
  if (!first) {
    logger.warn('Kaspi: не получено ни одного товара');
    return;
  }

  const cityPrices = first.allCityPrices;
  const cities =
    cityPrices && typeof cityPrices === 'object' ? Object.entries(cityPrices) : [];

  logger.info('Kaspi: первый товар', {
    ...first,
    allCityPrices: cities.length
      ? { городов: cities.length, пример: cities[0] }
      : cityPrices,
  });
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
