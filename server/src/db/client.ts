import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client';
import { env } from '../config/env';
import { logger } from '../lib/logger';

/**
 * Единственный экземпляр Prisma Client на весь процесс.
 * Каждый экземпляр держит свой пул соединений — если создавать их
 * по месту вызова, база быстро упрётся в лимит подключений.
 *
 * Prisma 7 ходит в PostgreSQL через драйвер-адаптер, отсюда PrismaPg.
 */
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  // Полный лог запросов пишет параметры, а там пароли и данные клиентов.
  log: ['error', 'warn'],
});

/**
 * Проверка, что база отвечает. Используется в /api/health.
 * Ошибку не пробрасываем: недоступность базы — это статус, а не падение.
 */
export async function isDatabaseReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('База данных недоступна', error);
    return false;
  }
}

/** Закрытие пула при остановке процесса. */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
