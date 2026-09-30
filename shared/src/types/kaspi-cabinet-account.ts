import type { KaspiLoginStatus } from '../constants/kaspi-cabinet';

/**
 * Доступ в кабинет Kaspi — то, что видно на странице «Настройки».
 *
 * Пароля здесь нет ни в каком виде: сервер его только принимает и хранит
 * зашифрованным, обратно не отдаёт.
 */
export interface KaspiCabinetAccountDto {
  /** Данные для входа сохранены. */
  configured: boolean;
  email: string | null;
  /** Есть сохранённая сессия кабинета — следующий запрос обойдётся без входа. */
  hasSession: boolean;
  /** Итог последней попытки входа. Пусто — входа ещё не было. */
  status: KaspiLoginStatus | null;
  /** Текст последней ошибки входа. */
  lastError: string | null;
  lastAttemptAt: string | null;
  /** До какого момента Kaspi не даёт входить. Пусто — ограничений нет. */
  blockedUntil: string | null;
  updatedAt: string | null;
}

export interface SaveKaspiCabinetAccountRequest {
  email: string;
  password: string;
}

/**
 * Один запрос к Kaspi при проверке подключения — для консоли браузера.
 *
 * Куки, пароль и одноразовые ключи входа (`code`, `state` в адресах)
 * сюда не попадают: вместо них звёздочки, у кук — только имена.
 */
export interface KaspiCabinetTraceStep {
  label: string;
  method: 'GET' | 'POST';
  url: string;
  /** Пусто — Kaspi не ответил вовсе. */
  status: number | null;
  /** Куда Kaspi отправил дальше, если это редирект. */
  location: string | null;
  contentType: string | null;
  /** Имена кук, которые поставил Kaspi. Значения не показываются. */
  cookiesSet: string[];
  /** Тело ответа, если это JSON. */
  body: unknown;
  /** Пояснение: для HTML — размер и заголовок страницы, для сбоя — причина. */
  note: string | null;
  durationMs: number;
}

export interface KaspiCabinetCheckResponse {
  ok: boolean;
  status: KaspiLoginStatus;
  message: string;
  /** Пришлось ли входить: false — сохранённая сессия была жива. */
  loggedIn: boolean;
  trace: KaspiCabinetTraceStep[];
  account: KaspiCabinetAccountDto;
}
