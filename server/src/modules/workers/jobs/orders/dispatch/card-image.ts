import { logger } from '../../../../../lib/logger';

/**
 * Фото товара для карточки — с CDN Kaspi, встраивается в картинку как data URI.
 *
 * Скачиваем сами, а не отдаём адрес рендеру: так есть таймаут и предел размера,
 * и зависший CDN не подвесит цикл. Не вышло — карточка уходит с заглушкой,
 * а не не уходит вовсе: заказ важнее фотографии.
 */

const IMAGE_TIMEOUT_MS = 10_000;

/** Фото карточки товара — сотни килобайт; больше пяти мегабайт — что-то не то. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Форматы, которые наверняка понимает рендер. Прочее — заглушка. */
const SUPPORTED_TYPES = ['image/jpeg', 'image/png'];

export async function loadImageDataUri(url: string | null): Promise<string | null> {
  if (url === null) return null;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) });
    const type = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';

    if (!response.ok || !SUPPORTED_TYPES.includes(type)) return null;

    const bytes = Buffer.from(await response.arrayBuffer());

    if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;

    return `data:${type};base64,${bytes.toString('base64')}`;
  } catch (error) {
    logger.warn(`Карточка: фото товара не загрузилось (${url})`, error);

    return null;
  }
}
