import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';

/**
 * Клиент к внутреннему JSON кабинета Kaspi.
 *
 * Это не документированный API, а запрос, которым кабинет наполняет свою же
 * страницу товаров. Он полнее XML-выгрузки, но может измениться без
 * предупреждения — поэтому ответ проверяется, а не принимается на веру.
 */

const CABINET_LIST_URL = 'https://mc.shop.kaspi.kz/bff/offer-view/list';

/** Кабинет отвечает за доли секунды; тридцать секунд — это уже «он не отвечает». */
const REQUEST_TIMEOUT_MS = 30_000;

export interface FetchPageParams {
  merchantId: string;
  cookie: string;
  page: number;
  pageSize: number;
  onSale: boolean;
}

/** Сырой товар из кабинета. Разбором полей занимается отдельный слой. */
export type RawCabinetOffer = Record<string, unknown>;

export interface CabinetPage {
  offers: RawCabinetOffer[];
  /**
   * Сколько товаров всего в этом режиме — кабинет присылает его на каждой
   * странице. По нему проверяем, что обход ничего не потерял.
   */
  total: number | null;
}

/** Одна страница списка товаров. Пустой массив — страницы кончились. */
export async function fetchOffersPage(
  params: FetchPageParams,
): Promise<CabinetPage> {
  const body = await fetchRawPage(params);

  const offers = extractOffers(body);

  if (offers === null) {
    // Ключи верхнего уровня — безопасная подсказка: имена полей, без значений.
    const keys =
      body && typeof body === 'object' ? Object.keys(body).join(', ') : typeof body;

    throw new AppError(
      502,
      'KASPI_BAD_RESPONSE',
      `В ответе кабинета нет списка товаров. Поля верхнего уровня: ${keys}`,
    );
  }

  return { offers, total: extractTotal(body) };
}

function extractTotal(body: unknown): number | null {
  if (!body || typeof body !== 'object') return null;

  const total = (body as Record<string, unknown>).total;

  return typeof total === 'number' ? total : null;
}

/**
 * Тело ответа как есть, без попыток найти в нём список.
 *
 * Нужно, пока форма ответа неизвестна: сырой JSON уходит на страницу, и его
 * видно в консоли браузера.
 */
export async function fetchRawPage(params: FetchPageParams): Promise<unknown> {
  const url = new URL(CABINET_LIST_URL);

  url.searchParams.set('m', params.merchantId);
  url.searchParams.set('p', String(params.page));
  url.searchParams.set('l', String(params.pageSize));
  url.searchParams.set('a', String(params.onSale));

  const response = await request(url, params.cookie);

  if (response.status === 401 || response.status === 403) {
    throw new AppError(
      401,
      'KASPI_UNAUTHORIZED',
      'Kaspi не принял куку — она протухла или скопирована не полностью',
    );
  }

  if (!response.ok) {
    throw new AppError(
      502,
      'KASPI_UNAVAILABLE',
      `Кабинет Kaspi ответил ${response.status}`,
    );
  }

  return readBody(response);
}

async function request(url: URL, cookie: string): Promise<Response> {
  try {
    return await fetch(url, {
      headers: {
        // Кука уходит заголовком, а не в адресе: адреса оседают в логах и в Referer.
        cookie,
        accept: 'application/json, text/plain, */*',
        'accept-language': 'ru-RU,ru;q=0.9',
        // Без правдоподобного клиента кабинет может ответить страницей-заглушкой.
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
        referer: 'https://mc.shop.kaspi.kz/',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'неизвестная причина';

    throw new AppError(
      502,
      'KASPI_UNAVAILABLE',
      `Не удалось обратиться к кабинету Kaspi: ${reason}`,
    );
  }
}

/**
 * Имена, под которыми обычно лежит список в подобных ответах.
 * Порядок важен: первое совпадение и берём.
 */
const OFFER_LIST_KEYS = ['data', 'offers', 'items', 'content', 'list', 'results', 'records'];

/**
 * Тело ответа разобранным JSON.
 *
 * Проверка — не педантизм: при протухшей сессии кабинет отвечает страницей
 * входа с кодом 200, и без неё это выглядело бы как пустой каталог.
 */
async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new AppError(
      502,
      'KASPI_BAD_RESPONSE',
      'Кабинет вернул не JSON — вероятно, вместо данных пришла страница входа',
    );
  }
}

/**
 * Достаёт список товаров из ответа.
 *
 * Кабинет может отдать как голый массив, так и объект-обёртку со счётчиками —
 * формат недокументированный, и завязываться на одну форму нельзя.
 * Возвращает null, если списка нет вовсе.
 */
function extractOffers(body: unknown): RawCabinetOffer[] | null {
  if (Array.isArray(body)) return body as RawCabinetOffer[];

  if (!body || typeof body !== 'object') return null;

  const record = body as Record<string, unknown>;

  for (const key of OFFER_LIST_KEYS) {
    if (Array.isArray(record[key])) {
      logger.debug(`Kaspi: список товаров найден в поле «${key}»`);

      return record[key] as RawCabinetOffer[];
    }
  }

  // Поле назвали иначе: берём единственный массив объектов, какой найдём.
  // Имя логируем — чтобы закрепить его в коде, когда оно станет известно.
  for (const [key, value] of Object.entries(record)) {
    // Непустой: пустых массивов в ответе может быть несколько (ошибки, фильтры),
    // и любой из них сошёл бы за «товары кончились».
    if (Array.isArray(value) && value.length > 0 && value.every(isPlainObject)) {
      logger.warn(`Kaspi: список товаров взят из незнакомого поля «${key}»`);

      return value as RawCabinetOffer[];
    }
  }

  return null;
}

function isPlainObject(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
