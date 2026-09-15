import path from 'node:path';

import { config as loadEnvFile } from 'dotenv';
import { z } from 'zod';

// Единый .env лежит в корне монорепозитория — и server, и front берут переменные оттуда.
// Путь считаем от самого файла, а не от cwd: иначе результат зависит от того,
// из какой папки запущена команда. Из src/ и из dist/ до корня одинаково три уровня.
loadEnvFile({ path: path.resolve(__dirname, '../../../.env') });

/**
 * Схема переменных окружения.
 *
 * Проверяем всё на старте: если чего-то не хватает, сервер должен упасть
 * сразу и с внятным текстом, а не через час в случайном запросе.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'не задан — сервер не сможет подключиться к базе'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Идентификатор продавца в Kaspi — он же в шапке кабинета. Не секрет, но в код
  // не зашиваем: у другого продавца он другой. Необязательный — без него просто
  // не работает загрузка каталога, остальной сервер поднимается.
  KASPI_MERCHANT_ID: z
    .string()
    .regex(/^\d+$/, 'должен состоять только из цифр')
    .optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  // Логгер здесь ещё не поднят, поэтому пишем напрямую.
  console.error(`Ошибка в переменных окружения (.env в корне проекта):\n${problems}`);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';

/** CORS_ORIGIN может содержать несколько адресов через запятую. */
export const corsOrigins = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
