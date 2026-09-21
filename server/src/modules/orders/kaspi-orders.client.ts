import { AppError } from '../../lib/errors';

/**
 * Клиент к официальному Kaspi Shop API — заказы.
 *
 * Токен для заказов рабочий (проверено 16.09.2026, в отличие от каталога).
 * Авторизация — заголовок `X-Auth-Token`, параметры — раздел 2.1
 * в docs/kaspi-api-integration.md.
 *
 * Ответ возвращается **как есть**: на этом шаге мы смотрим, какие поля
 * приходят, поэтому ничего не разбираем и не переименовываем.
 */

const ORDERS_URL = 'https://kaspi.kz/shop/api/v2/orders';

const REQUEST_TIMEOUT_MS = 30_000;

export interface KaspiOrdersParams {
  token: string;
  /** Границы периода в миллисекундах Unix — так их ждёт Kaspi. */
  from: number;
  to: number;
  /** Нумерация страниц с нуля. */
  page: number;
  pageSize: number;
}

export interface KaspiOrdersPage {
  /** Заказы как есть — разбирает их отдельный слой. */
  orders: unknown[];
  /** `meta` Kaspi как есть: totalCount, pageCount, pageNumber, pageSize. */
  meta: unknown;
}

export async function fetchKaspiOrders(params: KaspiOrdersParams): Promise<KaspiOrdersPage> {
  const body = await fetchKaspiOrdersRaw(params);

  if (!isRecord(body)) {
    throw new AppError(502, 'KASPI_BAD_RESPONSE', 'Kaspi вернул не объект');
  }

  if (!Array.isArray(body.data)) {
    // Имена полей — безопасная подсказка: значения в текст ошибки не попадают.
    const keys = Object.keys(body).join(', ');

    throw new AppError(
      502,
      'KASPI_BAD_RESPONSE',
      `В ответе Kaspi нет списка заказов. Поля верхнего уровня: ${keys}`,
    );
  }

  return { orders: body.data, meta: body.meta ?? null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Тело ответа целиком, без попыток найти в нём список. */
export async function fetchKaspiOrdersRaw(params: KaspiOrdersParams): Promise<unknown> {
  const url = new URL(ORDERS_URL);

  url.searchParams.set('page[number]', String(params.page));
  url.searchParams.set('page[size]', String(params.pageSize));
  url.searchParams.set('filter[orders][creationDate][$ge]', String(params.from));
  url.searchParams.set('filter[orders][creationDate][$le]', String(params.to));

  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        'X-Auth-Token': params.token,
        // Формат из документации Kaspi: с обычным application/json бывает 415.
        accept: 'application/vnd.api+json;charset=UTF-8',
        // Без правдоподобного клиента Kaspi иногда отвечает 403.
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'неизвестная причина';

    throw new AppError(502, 'KASPI_UNAVAILABLE', `Не удалось обратиться к Kaspi: ${reason}`);
  }

  if (response.status === 401 || response.status === 403) {
    throw new AppError(
      401,
      'KASPI_UNAUTHORIZED',
      'Kaspi не принял токен. Проверьте KASPI_API_TOKEN в .env',
    );
  }

  if (!response.ok) {
    // Текст ошибки Kaspi полезен: он объясняет, какой фильтр не понравился.
    const detail = await response.text().catch(() => '');

    throw new AppError(
      502,
      'KASPI_UNAVAILABLE',
      `Kaspi ответил ${response.status}${detail ? ': ' + detail.slice(0, 300) : ''}`,
    );
  }

  try {
    return await response.json();
  } catch {
    throw new AppError(502, 'KASPI_BAD_RESPONSE', 'Kaspi вернул не JSON');
  }
}
