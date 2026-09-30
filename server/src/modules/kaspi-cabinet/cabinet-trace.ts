/**
 * Маскировка трассы запросов к Kaspi перед отдачей в браузер.
 *
 * Трасса нужна, чтобы видеть в консоли, что отвечает Kaspi на каждом шаге
 * входа, — но в ответах и адресах ездят одноразовые ключи входа. Показывать
 * их незачем: по ним можно успеть войти вместо нас.
 */

const MASK = '***';

/** Параметры адреса с ключами входа: OAuth-код, состояние, токены. */
const SECRET_QUERY_PARAMS = new Set([
  'code', 'state', 'token', 'access_token', 'id_token', 'ticket', 'session', 'sessionid',
]);

/**
 * Поля тела, которые заменяются на любом уровне вложенности.
 * `code` сюда не входит намеренно: в нём Kaspi присылает код ошибки
 * (`CREDENTIALS_INVALID`), а он и есть то, ради чего смотрят трассу.
 */
const SECRET_BODY_KEYS = new Set([
  '_p', '_m_c', 'password', 'token', 'accesstoken', 'refreshtoken', 'idtoken', 'sessionid', 'cookie',
]);

export function maskUrl(raw: string): string {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return raw;
  }

  for (const key of [...url.searchParams.keys()]) {
    if (SECRET_QUERY_PARAMS.has(key.toLowerCase())) url.searchParams.set(key, MASK);
  }

  return url.toString();
}

export function maskBody(value: unknown): unknown {
  if (typeof value === 'string') {
    return /^https?:\/\//i.test(value) ? maskUrl(value) : value;
  }

  if (Array.isArray(value)) return value.map(maskBody);

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SECRET_BODY_KEYS.has(key.toLowerCase()) ? MASK : maskBody(item),
      ]),
    );
  }

  return value;
}

/** Только имя куки из заголовка Set-Cookie — значение и есть доступ. */
export function cookieName(setCookie: string): string {
  return setCookie.split('=', 1)[0]?.trim() ?? '';
}

/** Короткое описание не-JSON ответа: размер и заголовок страницы. */
export function describePage(text: string, contentType: string | null): string {
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(text)?.[1]?.trim();
  const kind = contentType?.split(';')[0] ?? 'без типа';

  return `${kind}, ${Buffer.byteLength(text)} байт${title ? `, «${title}»` : ''}`;
}
