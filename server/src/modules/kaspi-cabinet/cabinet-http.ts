import type { KaspiCabinetTraceStep } from '@radeya/shared';
import type { CookieJar } from 'tough-cookie';

import { AppError } from '../../lib/errors';
import { cookieName, describePage, maskBody, maskUrl } from './cabinet-trace';

/**
 * Запросы к кабинету Kaspi с банкой кук и записью трассы.
 *
 * Редиректы проходим сами: встроенный `fetch`, следуя за редиректом, теряет
 * куки промежуточных ответов и не переносит их на другой домен, а вход в
 * кабинет — это цепочка переходов между `mc.shop.kaspi.kz` и `idmc.shop.kaspi.kz`.
 */

export const CABINET_ORIGIN = 'https://mc.shop.kaspi.kz';
export const IDMC_ORIGIN = 'https://idmc.shop.kaspi.kz';

/** Без правдоподобного клиента кабинет может ответить страницей-заглушкой. */
export const CABINET_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

/** Кабинет отвечает за доли секунды; тридцать секунд — это уже «он не отвечает». */
export const CABINET_REQUEST_TIMEOUT_MS = 30_000;

/** Вход — три-четыре перехода. Десять — уже зацикливание, а не длинная цепочка. */
const MAX_REDIRECTS = 10;

/**
 * Код ошибки «кабинет не пустил». По нему withCabinetSession() понимает,
 * что сессия умерла, — входит заново и повторяет запрос.
 */
export const CABINET_UNAUTHORIZED_CODE = 'KASPI_UNAUTHORIZED';

/**
 * GET к данным кабинета с готовой кукой — для запросов через withCabinetSession():
 *
 *   withCabinetSession((cookie) => cabinetGetJson(url, cookie))
 *
 * Редиректы не проходит: без сессии кабинет уводит на вход, и это ответ
 * «не пустил» (KASPI_UNAUTHORIZED), а не данные. Возвращает JSON как есть.
 */
export async function cabinetGetJson(url: string, cookie: string): Promise<unknown> {
  return cabinetRequestJson(url, cookie, {
    method: 'GET',
    headers: { accept: 'application/json, text/plain, */*', referer: `${CABINET_ORIGIN}/` },
  });
}

/**
 * POST к данным кабинета — для GraphQL (`/mc/facade/graphql`). Правила те же,
 * что у cabinetGetJson: не пустил — KASPI_UNAUTHORIZED, и withCabinetSession
 * войдёт заново.
 *
 * Страница кабинета живёт на `kaspi.kz/mc`, поэтому Origin и Referer — оттуда:
 * так запрос выглядит ровно как из браузера.
 */
export async function cabinetPostJson(url: string, cookie: string, body: unknown): Promise<unknown> {
  return cabinetRequestJson(url, cookie, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
      origin: KASPI_SITE_ORIGIN,
      referer: `${KASPI_SITE_ORIGIN}/mc/`,
    },
    body: JSON.stringify(body),
  });
}

/** Сайт, с которого кабинет шлёт свои запросы. */
const KASPI_SITE_ORIGIN = 'https://kaspi.kz';

async function cabinetRequestJson(
  url: string,
  cookie: string,
  init: { method: 'GET' | 'POST'; headers: Record<string, string>; body?: string },
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: init.method,
      headers: {
        ...init.headers,
        // Кука уходит заголовком, а не в адресе: адреса оседают в логах и в Referer.
        cookie,
        'accept-language': 'ru-RU,ru;q=0.9',
        'user-agent': CABINET_USER_AGENT,
      },
      body: init.body,
      redirect: 'manual',
      signal: AbortSignal.timeout(CABINET_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'неизвестная причина';

    throw new AppError(502, 'KASPI_UNAVAILABLE', `Не удалось обратиться к кабинету Kaspi: ${reason}`);
  }

  if (response.status === 401 || response.status === 403 || isRedirect(response.status)) {
    throw new AppError(
      401,
      CABINET_UNAUTHORIZED_CODE,
      'Кабинет Kaspi не пустил — сессия истекла или кука скопирована не полностью',
    );
  }

  if (!response.ok) {
    throw new AppError(502, 'KASPI_UNAVAILABLE', `Кабинет Kaspi ответил ${response.status}`);
  }

  try {
    return await response.json();
  } catch {
    // При протухшей сессии кабинет может ответить и страницей входа с кодом 200 —
    // без этой проверки она выглядела бы как пустые данные.
    throw new AppError(
      502,
      'KASPI_BAD_RESPONSE',
      'Кабинет вернул не JSON — вероятно, вместо данных пришла страница входа',
    );
  }
}

export interface CabinetStepRequest {
  /** Подпись шага в трассе. */
  label: string;
  method: 'GET' | 'POST';
  url: string;
  /** Тело POST. В трассу не попадает — в нём пароль. */
  json?: unknown;
  referer?: string;
  /** Ждём JSON (запрос SPA) или страницу (переход браузера). */
  expect: 'json' | 'page';
}

export interface CabinetStepResult {
  status: number;
  url: string;
  /** Абсолютный адрес редиректа, без маскировки. */
  location: string | null;
  /** Разобранный JSON, для прочих ответов — null. */
  body: unknown;
  isJson: boolean;
}

/** Один запрос без автоматических редиректов. Куки берутся из банки и кладутся обратно. */
export async function sendStep(
  jar: CookieJar,
  request: CabinetStepRequest,
  trace: KaspiCabinetTraceStep[],
): Promise<CabinetStepResult> {
  const startedAt = Date.now();
  const cookie = await jar.getCookieString(request.url);

  const headers: Record<string, string> = {
    accept: request.expect === 'json'
      ? 'application/json, text/plain, */*'
      : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'ru-RU,ru;q=0.9',
    'user-agent': CABINET_USER_AGENT,
  };

  if (cookie) headers.cookie = cookie;
  if (request.referer) headers.referer = request.referer;

  let body: string | undefined;

  if (request.json !== undefined) {
    headers['content-type'] = 'application/json';
    headers.origin = new URL(request.url).origin;
    body = JSON.stringify(request.json);

    // Браузерный axios сам отправляет куку XSRF-TOKEN заголовком. Повторяем это:
    // нет такой куки — заголовка нет, и вреда от проверки никакого.
    const xsrf = (await jar.getCookies(request.url)).find((item) => item.key === 'XSRF-TOKEN');

    if (xsrf) headers['x-xsrf-token'] = decodeURIComponent(xsrf.value);
  }

  let response: Response;

  try {
    response = await fetch(request.url, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(CABINET_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'неизвестная причина';

    trace.push({
      label: request.label,
      method: request.method,
      url: maskUrl(request.url),
      status: null,
      location: null,
      contentType: null,
      cookiesSet: [],
      body: null,
      note: `Нет ответа: ${reason}`,
      durationMs: Date.now() - startedAt,
    });

    throw new AppError(
      502,
      'KASPI_UNAVAILABLE',
      `Кабинет Kaspi не ответил на шаге «${request.label}»: ${reason}`,
    );
  }

  const setCookies = response.headers.getSetCookie();

  for (const header of setCookies) {
    // ignoreError: кука с чужим доменом или кривым атрибутом — не повод рвать вход,
    // браузер тоже её молча отбросил бы.
    await jar.setCookie(header, request.url, { ignoreError: true });
  }

  const rawLocation = response.headers.get('location');
  const location = rawLocation ? new URL(rawLocation, request.url).toString() : null;
  const contentType = response.headers.get('content-type');
  const text = await response.text();

  let parsed: unknown = null;
  let isJson = false;

  if (text && (contentType?.includes('json') || /^\s*[{[]/.test(text))) {
    try {
      parsed = JSON.parse(text);
      isJson = true;
    } catch {
      // Не JSON — опишем ниже как страницу.
    }
  }

  trace.push({
    label: request.label,
    method: request.method,
    url: maskUrl(request.url),
    status: response.status,
    location: location ? maskUrl(location) : null,
    contentType,
    cookiesSet: setCookies.map(cookieName),
    body: isJson ? maskBody(parsed) : null,
    note: !isJson && text ? describePage(text, contentType) : null,
    durationMs: Date.now() - startedAt,
  });

  return { status: response.status, url: request.url, location, body: parsed, isJson };
}

/** GET с проходом по редиректам. Возвращает последний ответ цепочки. */
export async function followRedirects(
  jar: CookieJar,
  label: string,
  url: string,
  trace: KaspiCabinetTraceStep[],
): Promise<CabinetStepResult> {
  let current = url;
  let referer: string | undefined;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const result = await sendStep(jar, {
      label: hop === 0 ? label : `${label} → переход ${hop}`,
      method: 'GET',
      url: current,
      referer,
      expect: 'page',
    }, trace);

    if (!isRedirect(result.status) || !result.location) return result;

    referer = current;
    current = result.location;
  }

  throw new AppError(
    502,
    'KASPI_BAD_RESPONSE',
    `Больше ${MAX_REDIRECTS} переходов на шаге «${label}» — цепочка входа зациклилась`,
  );
}

export function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}
