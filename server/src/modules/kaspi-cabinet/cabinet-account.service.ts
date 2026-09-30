import {
  KASPI_LOGIN_STATUSES,
  type KaspiCabinetAccountDto,
  type KaspiLoginStatus,
  type SaveKaspiCabinetAccountRequest,
} from '@radeya/shared';
import { CookieJar } from 'tough-cookie';

import { prisma } from '../../db/client';
import type { KaspiCabinetAccount } from '../../generated/prisma/client';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { decryptSecret, encryptSecret } from '../../lib/secret-box';
import type { CabinetCredentials, LoginOutcome } from './cabinet-login.client';

/**
 * Хранение доступа в кабинет Kaspi: одна запись, секреты зашифрованы.
 * Сам вход — в cabinet-session.service.ts.
 */

const ACCOUNT_ID = 'main';

/** Доступ в кабинет, расшифрованный для входа. Наружу не отдаётся. */
export interface StoredCabinetAccount {
  credentials: CabinetCredentials;
  /**
   * Метка версии данных для входа. Итог входа пишется только если пароль
   * за время входа не сменили — иначе сессия от старых данных легла бы
   * поверх только что сохранённых новых.
   */
  passwordEncrypted: string;
  /** Пусто — сохранённой сессии нет. */
  jar: CookieJar | null;
  status: KaspiLoginStatus | null;
  lastError: string | null;
  blockedUntil: Date | null;
}

export function newCabinetJar(): CookieJar {
  // looseMode: кука без `=` — не повод её терять, браузер её тоже примет.
  return new CookieJar(undefined, { looseMode: true });
}

export async function getCabinetAccount(): Promise<KaspiCabinetAccountDto> {
  const row = await prisma.kaspiCabinetAccount.findUnique({ where: { id: ACCOUNT_ID } });

  return toAccountDto(row);
}

/**
 * Сохранение email и пароля. Входа здесь нет: данные проверяются кнопкой
 * «Проверить подключение» или первым запросом, которому нужен кабинет.
 *
 * Сохранённая сессия сбрасывается: иначе проверка после смены пароля увидела бы
 * живую старую сессию и сказала «всё в порядке», не проверив новый пароль.
 */
export async function saveCabinetAccount(
  input: SaveKaspiCabinetAccountRequest,
): Promise<{ previousEmail: string | null; account: KaspiCabinetAccountDto }> {
  // Шифруем до обращения к базе: нет ключа — ничего не пишем.
  const passwordEncrypted = encryptSecret(input.password);

  const previous = await prisma.kaspiCabinetAccount.findUnique({
    where: { id: ACCOUNT_ID },
    select: { email: true },
  });

  const emailChanged = previous?.email !== input.email;

  const row = await prisma.kaspiCabinetAccount.upsert({
    where: { id: ACCOUNT_ID },
    create: { id: ACCOUNT_ID, email: input.email, passwordEncrypted },
    update: {
      email: input.email,
      passwordEncrypted,
      sessionEncrypted: null,
      lastLoginStatus: null,
      lastLoginError: null,
      // Пауза Kaspi относится к учётной записи: сменили её — пауза не наша.
      ...(emailChanged ? { blockedUntil: null } : {}),
    },
  });

  return { previousEmail: previous?.email ?? null, account: toAccountDto(row) };
}

export async function loadStoredAccount(): Promise<StoredCabinetAccount> {
  const row = await prisma.kaspiCabinetAccount.findUnique({ where: { id: ACCOUNT_ID } });

  if (!row) {
    throw new AppError(
      409,
      'KASPI_CABINET_NOT_CONFIGURED',
      'Данные для входа в кабинет Kaspi не указаны — «Настройки» → «Кабинет Kaspi»',
    );
  }

  return {
    credentials: { email: row.email, password: decryptSecret(row.passwordEncrypted) },
    passwordEncrypted: row.passwordEncrypted,
    jar: row.sessionEncrypted ? await readJar(row.sessionEncrypted) : null,
    status: row.lastLoginStatus,
    lastError: row.lastLoginError,
    blockedUntil: row.blockedUntil,
  };
}

/**
 * Итог входа. Успех — сохраняем банку кук, неудача — стираем: сессия в ней
 * уже мертва, раз понадобилось входить, и `hasSession` не должен врать.
 */
export async function recordLoginResult(
  account: StoredCabinetAccount,
  outcome: LoginOutcome,
  jar: CookieJar,
): Promise<void> {
  const succeeded = outcome.status === KASPI_LOGIN_STATUSES.OK;

  await prisma.kaspiCabinetAccount.updateMany({
    where: { id: ACCOUNT_ID, passwordEncrypted: account.passwordEncrypted },
    data: {
      lastLoginStatus: outcome.status,
      lastLoginError: outcome.message,
      lastAttemptAt: new Date(),
      blockedUntil: outcome.blockedUntil,
      sessionEncrypted: succeeded ? await writeJar(jar) : null,
    },
  });
}

/** Банка после удачного запроса — Kaspi мог обновить куки сессии. */
export async function saveSession(account: StoredCabinetAccount, jar: CookieJar): Promise<void> {
  await prisma.kaspiCabinetAccount.updateMany({
    where: { id: ACCOUNT_ID, passwordEncrypted: account.passwordEncrypted },
    data: { sessionEncrypted: await writeJar(jar) },
  });
}

async function writeJar(jar: CookieJar): Promise<string> {
  return encryptSecret(JSON.stringify(await jar.serialize()));
}

async function readJar(box: string): Promise<CookieJar | null> {
  try {
    return await CookieJar.deserialize(decryptSecret(box));
  } catch (error) {
    // Испорченная сессия — не повод отказывать: просто войдём заново.
    logger.warn('Kaspi: сохранённую сессию кабинета не прочитать, войдём заново', error);

    return null;
  }
}

function toAccountDto(row: KaspiCabinetAccount | null): KaspiCabinetAccountDto {
  if (!row) {
    return {
      configured: false,
      email: null,
      hasSession: false,
      status: null,
      lastError: null,
      lastAttemptAt: null,
      blockedUntil: null,
      updatedAt: null,
    };
  }

  return {
    configured: true,
    email: row.email,
    hasSession: row.sessionEncrypted !== null,
    status: row.lastLoginStatus,
    lastError: row.lastLoginError,
    lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    // Прошедшая пауза уже не ограничение — не показываем её.
    blockedUntil: row.blockedUntil && row.blockedUntil > new Date()
      ? row.blockedUntil.toISOString()
      : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}
