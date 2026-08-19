import { isProduction } from './env';

/** Имя куки сессии. Без намёка на стек — меньше подсказок для сканеров. */
export const SESSION_COOKIE_NAME = 'radeya_sid';

/** Срок жизни сессии. Продлевается при активности, см. auth.service. */
export const SESSION_TTL_DAYS = 7;

export const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Настройки куки сессии.
 *
 * httpOnly — куку не видно из JavaScript, поэтому её нельзя украсть через XSS.
 * Это и есть причина, по которой мы не отдаём токен фронту.
 *
 * sameSite lax — кука не уходит на сторонние домены при переходах,
 * это защита от CSRF. Порт роли не играет: localhost:3000 и localhost:4000
 * считаются одним сайтом, так что в разработке всё работает.
 *
 * secure только в проде: по http кука с этим флагом не поставится вовсе.
 */
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProduction,
  path: '/',
  maxAge: SESSION_TTL_MS,
} as const;
