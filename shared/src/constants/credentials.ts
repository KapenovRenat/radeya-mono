/**
 * Правила логина и пароля. Лежат в shared, потому что нужны обеим сторонам:
 * сервер по ним валидирует, фронт по ним подсказывает в форме.
 *
 * Проверка на сервере обязательна в любом случае — фронтовая только для удобства.
 */

export const LOGIN_MIN_LENGTH = 3;
export const LOGIN_MAX_LENGTH = 32;

/**
 * Латиница, цифры, точка, подчёркивание и дефис. Только нижний регистр:
 * логин приводится к нему до сохранения, иначе `Ivan` и `ivan` окажутся
 * разными учётными записями.
 */
export const LOGIN_PATTERN = /^[a-z0-9._-]+$/;

export const LOGIN_RULES_HINT =
  'Латиница, цифры, точка, дефис и подчёркивание. От 3 до 32 символов.';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Только печатные символы ASCII. Кириллица в пароле — источник проблем:
 * раскладка на чужой машине, разные кодировки при копировании.
 */
export const PASSWORD_PATTERN = /^[\x21-\x7e]+$/;

export const PASSWORD_RULES_HINT =
  'Латиница, цифры и знаки препинания. Не короче 8 символов.';

/** Приведение логина к каноническому виду перед проверкой и сохранением. */
export function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}
