/**
 * Кука сессии кабинета Kaspi — только в памяти процесса.
 *
 * Ни в базу, ни в файл, ни в лог: это по сути пароль от кабинета.
 * Перезапустили сервер — вставляем заново. Неудобство сознательное:
 * секрет, записанный на диск, рано или поздно уезжает в бэкап или в git.
 */

let storedCookie: string | null = null;

export function rememberCookie(cookie: string): void {
  storedCookie = cookie;
}

export function forgetCookie(): void {
  storedCookie = null;
}

export function getStoredCookie(): string | null {
  return storedCookie;
}

export function hasStoredCookie(): boolean {
  return storedCookie !== null;
}
