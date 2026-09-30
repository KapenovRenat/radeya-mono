import {
  KASPI_LOGIN_STATUSES,
  type KaspiCabinetTraceStep,
  type KaspiLoginStatus,
} from '@radeya/shared';
import type { CookieJar } from 'tough-cookie';

import { isRecord } from '../orders/kaspi-orders.mapper';
import { CABINET_ORIGIN, IDMC_ORIGIN, followRedirects, sendStep } from './cabinet-http';

/**
 * Вход в кабинет Kaspi по email и паролю — без браузера.
 *
 * Схема взята из кода страницы входа (разведка 29.09.2026, «Как заходим»
 * в docs/kaspi-api-integration.md): начало OAuth2 в кабинете → JSON-вход
 * на `idmc` → переход по `redirectUrl` обратно, где кабинет ставит куку сессии.
 * API не документирован: сломается — трасса покажет, на каком шаге.
 */

const LOGIN_START_URL = `${CABINET_ORIGIN}/oauth2/authorization/1`;
const LOGIN_API_URL = `${IDMC_ORIGIN}/api/p/login`;

export interface CabinetCredentials {
  email: string;
  password: string;
}

export interface LoginOutcome {
  status: KaspiLoginStatus;
  /** Для OK — пусто. */
  message: string | null;
  /** Пауза, назначенная Kaspi. */
  blockedUntil: Date | null;
}

/** Коды ошибок из кода страницы входа — в понятный текст. */
const KASPI_LOGIN_ERRORS: Record<string, string> = {
  CREDENTIALS_INVALID: 'Kaspi не принял email или пароль',
  INSUFFICIENT_PERMISSIONS: 'У учётной записи нет доступа к кабинету магазина',
  NO_MERCHANTS: 'К учётной записи не привязан ни один магазин',
  MFA_CODE_ATTEMPT_LIMIT: 'Исчерпаны попытки ввода кода из письма',
  MFA_SEND_FLOOD: 'Kaspi слишком часто отправлял код на почту',
  MFA_CODE_TOO_MANY_SEND: 'Kaspi слишком часто отправлял код на почту',
  SECURITY_CODE_INVALID: 'Неверный код из письма',
  TIMEOUT_EXCEEDED: 'Время на вход истекло',
};

/**
 * Полный вход. В банку ложатся куки сессии; банка может быть не пустой —
 * кука «запомненного устройства» от прошлых входов избавляет от кода на почту.
 *
 * Сетевой сбой бросает AppError; всё, что Kaspi ответил, — в LoginOutcome.
 */
export async function loginToCabinet(
  jar: CookieJar,
  credentials: CabinetCredentials,
  trace: KaspiCabinetTraceStep[],
): Promise<LoginOutcome> {
  // Кабинет запоминает начатый вход в своей куке и уводит на страницу входа.
  // Без этого шага ответ на `redirectUrl` ему будет не с чем сверить.
  const loginPage = await followRedirects(jar, 'Начало входа', LOGIN_START_URL, trace);

  const answer = await sendStep(jar, {
    label: 'Email и пароль',
    method: 'POST',
    url: LOGIN_API_URL,
    // _r_d — «запомнить устройство»: следующий вход реже упрётся в код на почту.
    json: { _u: credentials.email, _p: credentials.password, _r_d: true },
    referer: loginPage.url,
    expect: 'json',
  }, trace);

  const body = isRecord(answer.body) ? answer.body : null;
  const succeeded = answer.status >= 200 && answer.status < 300;

  if (succeeded && body && typeof body.redirectUrl === 'string') {
    await followRedirects(
      jar,
      'Возврат в кабинет',
      new URL(body.redirectUrl, IDMC_ORIGIN).toString(),
      trace,
    );

    return { status: KASPI_LOGIN_STATUSES.OK, message: null, blockedUntil: null };
  }

  if (succeeded && body && 'email' in body) {
    return fail(
      KASPI_LOGIN_STATUSES.CODE_REQUIRED,
      'Kaspi отправил код на почту. Вход с кодом пока не поддержан — '
        + 'войдите в кабинет в обычном браузере и повторите проверку позже',
    );
  }

  if (succeeded && body && 'su' in body) {
    return fail(
      KASPI_LOGIN_STATUSES.MERCHANT_CHOICE_REQUIRED,
      'Kaspi просит выбрать магазин — у учётной записи их несколько. Выбор магазина пока не поддержан',
    );
  }

  return readLoginError(answer.status, body);
}

function readLoginError(status: number, body: Record<string, unknown> | null): LoginOutcome {
  // Форма ошибки не документирована: код ищем и в корне, и во вложенном `error`.
  const source = body && isRecord(body.error) ? body.error : body;
  const code = source ? readErrorCode(source) : null;
  const breakSeconds = readBreakSeconds(source) ?? readBreakSeconds(body);
  const text = code
    ? KASPI_LOGIN_ERRORS[code] ?? `Kaspi вернул ошибку ${code}`
    : `Kaspi ответил ${status} без понятного результата — смотрите трассу в консоли`;

  if (breakSeconds !== null) {
    const minutes = Math.ceil(breakSeconds / 60);

    return {
      status: KASPI_LOGIN_STATUSES.BLOCKED,
      message: `${text}. Повторить вход можно через ${minutes} мин.`,
      blockedUntil: new Date(Date.now() + breakSeconds * 1000),
    };
  }

  if (code === 'CREDENTIALS_INVALID') {
    return fail(KASPI_LOGIN_STATUSES.CREDENTIALS_INVALID, text);
  }

  return fail(KASPI_LOGIN_STATUSES.ERROR, text);
}

/** Код ошибки Kaspi — строка вида `CREDENTIALS_INVALID` в одном из привычных полей. */
function readErrorCode(source: Record<string, unknown>): string | null {
  for (const key of ['code', 'errorCode', 'error', 'type']) {
    const value = source[key];

    if (typeof value === 'string' && /^[A-Z][A-Z0-9_]+$/.test(value)) return value;
  }

  return null;
}

function readBreakSeconds(source: Record<string, unknown> | null): number | null {
  const value = source?.breakTimeSeconds;

  return typeof value === 'number' && value > 0 ? value : null;
}

function fail(status: KaspiLoginStatus, message: string): LoginOutcome {
  return { status, message, blockedUntil: null };
}
