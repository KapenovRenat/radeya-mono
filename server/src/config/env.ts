import 'dotenv/config';
import { z } from 'zod';

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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  // Логгер здесь ещё не поднят, поэтому пишем напрямую.
  console.error(`Ошибка в переменных окружения (server/.env):\n${problems}`);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';

/** CORS_ORIGIN может содержать несколько адресов через запятую. */
export const corsOrigins = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
