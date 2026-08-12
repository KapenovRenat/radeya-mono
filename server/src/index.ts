import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { disconnectDatabase } from './db/client';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API запущен: http://localhost:${env.PORT}/api/health (${env.NODE_ENV})`);
});

/**
 * Корректное завершение: перестаём принимать новые запросы,
 * даём доработать текущим, закрываем пул соединений с базой.
 * Без этого при перезапуске часть запросов обрывается на середине,
 * а соединения в PostgreSQL висят до таймаута.
 */
function shutdown(signal: string): void {
  logger.info(`Получен ${signal}, останавливаю сервер`);

  server.close(async () => {
    await disconnectDatabase();
    logger.info('Сервер остановлен');
    process.exit(0);
  });

  // Если за 10 секунд не закрылся — выходим принудительно.
  setTimeout(() => {
    logger.error('Не удалось остановиться штатно, выхожу принудительно');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
