import {
  KASPI_LOGIN_STATUSES,
  type KaspiCabinetTraceStep,
  type KaspiLoginStatus,
} from '@radeya/shared';
import type { CookieJar } from 'tough-cookie';

import { env } from '../../config/env';
import { AppError, ValidationError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import {
  loadStoredAccount,
  newCabinetJar,
  recordLoginResult,
  saveSession,
  type StoredCabinetAccount,
} from './cabinet-account.service';
import { CABINET_ORIGIN, sendStep } from './cabinet-http';
import { loginToCabinet, type LoginOutcome } from './cabinet-login.client';

/**
 * Сессия кабинета Kaspi по требованию.
 *
 * Вход не держится постоянно и не обновляется по таймеру. Кому нужен кабинет —
 * вызывает withCabinetSession(): сохранённая сессия жива — запрос идёт сразу,
 * умерла — один вход и один повтор. Каждый лишний вход — шаг к блокировке
 * учётной записи, поэтому входим только когда без этого никак.
 */

/** Код ошибки, по которому потребитель сообщает «кабинет меня не пустил». */
export const CABINET_UNAUTHORIZED_CODE = 'KASPI_UNAUTHORIZED';

/**
 * После этих итогов сервер сам больше не входит: повтор с тем же паролем
 * не поможет, а код на почту и выбор магазина требуют человека. Снимается
 * сохранением данных для входа или кнопкой «Проверить подключение».
 */
const AUTO_LOGIN_STOPS = new Set<KaspiLoginStatus>([
  KASPI_LOGIN_STATUSES.CREDENTIALS_INVALID,
  KASPI_LOGIN_STATUSES.CODE_REQUIRED,
  KASPI_LOGIN_STATUSES.MERCHANT_CHOICE_REQUIRED,
]);

type LoginMode = 'auto' | 'manual';

interface LoginRun {
  jar: CookieJar;
  outcome: LoginOutcome;
  trace: KaspiCabinetTraceStep[];
}

export interface CabinetCheckResult {
  ok: boolean;
  status: KaspiLoginStatus;
  message: string;
  loggedIn: boolean;
  trace: KaspiCabinetTraceStep[];
}

/** Вход не удался — с итогом, чтобы проверка подключения показала его как есть. */
export class CabinetLoginError extends AppError {
  constructor(readonly loginStatus: KaspiLoginStatus, message: string) {
    super(loginErrorHttpStatus(loginStatus), `KASPI_LOGIN_${loginStatus}`, message);
  }
}

/**
 * Запрос к кабинету с сессией. `run` получает заголовок Cookie для
 * `mc.shop.kaspi.kz` и должен бросить AppError с кодом KASPI_UNAUTHORIZED,
 * если кабинет не пустил: тогда будет один вход и один повтор, не больше.
 */
export async function withCabinetSession<T>(run: (cookie: string) => Promise<T>): Promise<T> {
  const account = await loadStoredAccount();

  if (account.jar) {
    try {
      return await run(await account.jar.getCookieString(CABINET_ORIGIN));
    } catch (error) {
      if (!isCabinetUnauthorized(error)) throw error;

      logger.info('Kaspi: сессия кабинета истекла — входим заново');
    }
  }

  const login = await loginOnce('auto');

  if (login.outcome.status !== KASPI_LOGIN_STATUSES.OK) throw toLoginError(login.outcome);

  return run(await login.jar.getCookieString(CABINET_ORIGIN));
}

/**
 * Кнопка «Проверить подключение»: тот же путь, что у любого потребителя, —
 * жива сессия, значит входа нет. Всё, что ответил Kaspi, — в трассе.
 *
 * Итог отдаётся ответом, а не ошибкой: неудачная проверка — это тоже
 * результат, и трасса нужна именно в этом случае.
 */
export async function checkCabinetConnection(): Promise<CabinetCheckResult> {
  requireMerchantId();

  const account = await loadStoredAccount();
  const trace: KaspiCabinetTraceStep[] = [];

  if (account.jar) {
    try {
      if (await probeSession(account.jar, trace)) {
        await saveSession(account, account.jar);

        return {
          ok: true,
          status: KASPI_LOGIN_STATUSES.OK,
          message: 'Сохранённая сессия жива — входить не понадобилось',
          loggedIn: false,
          trace,
        };
      }
    } catch (error) {
      if (!(error instanceof AppError)) throw error;

      return failedCheck(KASPI_LOGIN_STATUSES.ERROR, error.message, trace);
    }
  }

  try {
    const login = await loginOnce('manual');
    const ok = login.outcome.status === KASPI_LOGIN_STATUSES.OK;

    return {
      ok,
      status: login.outcome.status,
      message: login.outcome.message ?? 'Вход выполнен, кабинет отвечает',
      loggedIn: true,
      trace: [...trace, ...login.trace],
    };
  } catch (error) {
    if (!(error instanceof CabinetLoginError)) throw error;

    return failedCheck(error.loginStatus, error.message, trace);
  }
}

export function isCabinetUnauthorized(error: unknown): boolean {
  return error instanceof AppError && error.code === CABINET_UNAUTHORIZED_CODE;
}

let loginInFlight: Promise<LoginRun> | null = null;

/**
 * Один вход на процесс. Параллельные запросы ждут тот же вход, а не запускают
 * свои: пачка входов подряд — ровно то, за что Kaspi блокирует.
 */
function loginOnce(mode: LoginMode): Promise<LoginRun> {
  loginInFlight ??= performLogin(mode).finally(() => {
    loginInFlight = null;
  });

  return loginInFlight;
}

async function performLogin(mode: LoginMode): Promise<LoginRun> {
  requireMerchantId();

  // Читаем заново, а не берём у вызвавшего: пока ждали, пароль могли сменить.
  const account = await loadStoredAccount();

  assertLoginAllowed(account, mode);

  // Прежняя банка, если была: в ней кука «запомненного устройства».
  const jar = account.jar ?? newCabinetJar();
  const trace: KaspiCabinetTraceStep[] = [];
  let outcome: LoginOutcome;

  try {
    outcome = await loginToCabinet(jar, account.credentials, trace);

    // Kaspi мог принять пароль, а кабинет — не выдать сессию. Верим только
    // настоящему ответу кабинета.
    if (outcome.status === KASPI_LOGIN_STATUSES.OK && !(await probeSession(jar, trace))) {
      outcome = {
        status: KASPI_LOGIN_STATUSES.ERROR,
        message: 'Kaspi принял пароль, но кабинет не пустил — смотрите трассу в консоли',
        blockedUntil: null,
      };
    }
  } catch (error) {
    if (!(error instanceof AppError)) throw error;

    outcome = { status: KASPI_LOGIN_STATUSES.ERROR, message: error.message, blockedUntil: null };
  }

  await recordLoginResult(account, outcome, jar);

  if (outcome.status === KASPI_LOGIN_STATUSES.OK) {
    logger.info('Kaspi: вход в кабинет выполнен');
  } else {
    logger.warn(`Kaspi: вход в кабинет не удался — ${outcome.status}: ${outcome.message}`);
  }

  return { jar, outcome, trace };
}

function assertLoginAllowed(account: StoredCabinetAccount, mode: LoginMode): void {
  if (account.blockedUntil && account.blockedUntil > new Date()) {
    const minutes = Math.ceil((account.blockedUntil.getTime() - Date.now()) / 60_000);

    throw new CabinetLoginError(
      KASPI_LOGIN_STATUSES.BLOCKED,
      `Kaspi не даёт входить ещё ${minutes} мин. Повторите позже`,
    );
  }

  if (mode === 'auto' && account.status && AUTO_LOGIN_STOPS.has(account.status)) {
    throw toLoginError({
      status: account.status,
      message: account.lastError,
      blockedUntil: null,
    });
  }
}

/**
 * Живая ли сессия: одна страница товаров на один товар. Запрос дешёвый
 * и требует входа — лучше проверки не придумать, не зная прочих адресов кабинета.
 */
async function probeSession(jar: CookieJar, trace: KaspiCabinetTraceStep[]): Promise<boolean> {
  const url = new URL(`${CABINET_ORIGIN}/bff/offer-view/list`);

  url.searchParams.set('m', requireMerchantId());
  url.searchParams.set('p', '0');
  url.searchParams.set('l', '1');
  url.searchParams.set('a', 'true');

  const result = await sendStep(jar, {
    label: 'Проверка сессии: одна страница товаров',
    method: 'GET',
    url: url.toString(),
    referer: `${CABINET_ORIGIN}/`,
    expect: 'json',
  }, trace);

  // Без сессии кабинет отвечает редиректом на вход или страницей входа с кодом 200 —
  // поэтому смотрим не только на код, но и на то, что пришёл JSON.
  return result.status === 200 && result.isJson;
}

function requireMerchantId(): string {
  if (!env.KASPI_MERCHANT_ID) {
    throw new ValidationError('Не задан KASPI_MERCHANT_ID в .env — кабинет Kaspi не проверить');
  }

  return env.KASPI_MERCHANT_ID;
}

function toLoginError(outcome: LoginOutcome): CabinetLoginError {
  const reason = outcome.message ?? 'Вход в кабинет Kaspi не удался';

  return new CabinetLoginError(
    outcome.status,
    `${reason}. Проверьте «Настройки» → «Кабинет Kaspi»`,
  );
}

function loginErrorHttpStatus(status: KaspiLoginStatus): number {
  if (status === KASPI_LOGIN_STATUSES.BLOCKED) return 429;
  if (status === KASPI_LOGIN_STATUSES.ERROR) return 502;

  return 409;
}

/** Проверка не дошла до входа: упала раньше или вход не разрешён. */
function failedCheck(
  status: KaspiLoginStatus,
  message: string,
  trace: KaspiCabinetTraceStep[],
): CabinetCheckResult {
  return { ok: false, status, message, loggedIn: false, trace };
}
