import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { env } from '../config/env';
import { AppError } from './errors';

/**
 * Шифрование секретов, которые приходится хранить в базе в обратимом виде:
 * пароль и куки кабинета Kaspi. Хеш тут не годится — пароль нужно отправлять.
 *
 * AES-256-GCM: кроме шифрования проверяет целостность, и подменённая в базе
 * строка не расшифруется в мусор, а упадёт ошибкой.
 *
 * Формат строки: `v1:<iv>:<tag>:<данные>`, всё в base64. Версия впереди —
 * чтобы однажды сменить схему, не теряя уже сохранённое.
 */

const ALGORITHM = 'aes-256-gcm';
const FORMAT_VERSION = 'v1';

/** 12 байт — рекомендованная длина вектора для GCM. */
const IV_BYTES = 12;

function readKey(): Buffer {
  if (!env.KASPI_SECRETS_KEY) {
    throw new AppError(
      503,
      'SECRETS_KEY_MISSING',
      'Не задан KASPI_SECRETS_KEY в .env — данные для входа в Kaspi не зашифровать',
    );
  }

  return Buffer.from(env.KASPI_SECRETS_KEY, 'base64');
}

export function encryptSecret(plain: string): string {
  // Новый вектор на каждое шифрование: повтор вектора с тем же ключом
  // в GCM раскрывает данные.
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, readKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);

  return [
    FORMAT_VERSION,
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    data.toString('base64'),
  ].join(':');
}

export function decryptSecret(box: string): string {
  const key = readKey();
  const [version, iv, tag, data] = box.split(':');

  if (version !== FORMAT_VERSION || !iv || !tag || data === undefined) {
    throw unreadable();
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'));

    decipher.setAuthTag(Buffer.from(tag, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(data, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw unreadable();
  }
}

function unreadable(): AppError {
  return new AppError(
    500,
    'SECRET_UNREADABLE',
    'Сохранённые данные Kaspi не расшифровать — скорее всего, сменился KASPI_SECRETS_KEY. '
      + 'Укажите email и пароль заново',
  );
}
