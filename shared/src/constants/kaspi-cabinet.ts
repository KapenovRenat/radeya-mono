/**
 * Вход в кабинет Kaspi по email и паролю.
 *
 * Сервер входит сам и только тогда, когда кабинет понадобился: сохранённая
 * сессия жива — входа нет. Подробности — «Как заходим» в
 * docs/kaspi-api-integration.md.
 */

/**
 * Итог последней попытки входа.
 *
 * Значения обязаны совпадать с enum KaspiLoginStatus в schema.prisma.
 */
export const KASPI_LOGIN_STATUSES = {
  OK: 'OK',
  CODE_REQUIRED: 'CODE_REQUIRED',
  MERCHANT_CHOICE_REQUIRED: 'MERCHANT_CHOICE_REQUIRED',
  CREDENTIALS_INVALID: 'CREDENTIALS_INVALID',
  BLOCKED: 'BLOCKED',
  ERROR: 'ERROR',
} as const;

export type KaspiLoginStatus = (typeof KASPI_LOGIN_STATUSES)[keyof typeof KASPI_LOGIN_STATUSES];

export const KASPI_LOGIN_STATUS_LABELS: Record<KaspiLoginStatus, string> = {
  OK: 'Вход выполнен',
  CODE_REQUIRED: 'Kaspi просит код из письма',
  MERCHANT_CHOICE_REQUIRED: 'Kaspi просит выбрать магазин',
  CREDENTIALS_INVALID: 'Kaspi не принял email или пароль',
  BLOCKED: 'Вход временно заблокирован Kaspi',
  ERROR: 'Ошибка входа',
};

/** Предел адреса почты по RFC 5321. */
export const KASPI_CABINET_EMAIL_MAX_LENGTH = 254;

export const KASPI_CABINET_PASSWORD_MAX_LENGTH = 128;
