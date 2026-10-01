import { env } from './config/env';
import { logger } from './lib/logger';
import { ordersJob } from './modules/workers/orders.job';
import { startWorker } from './modules/workers/worker-engine';

/**
 * Процесс воркеров — отдельно от API (`npm run worker`). Падение воркера
 * не роняет API, перезапуск API не обрывает цикл. Устройство — docs/workers.md.
 *
 * Запускается только при WORKERS_ENABLED=true: копия боевой базы с галочкой
 * «Работает» иначе начала бы тянуть заказы и слать поставщикам с ноутбука.
 */
if (!env.WORKERS_ENABLED) {
  logger.warn('WORKERS_ENABLED не равен true — воркеры на этом сервере не запускаются');
  process.exit(0);
}

// Необработанная ошибка — процесс выходит, PM2 поднимает его заново,
// а воркер при старте сам отметит «перезапуск после сбоя». Жить дальше
// в неизвестном состоянии хуже, чем перезапуститься.
process.on('unhandledRejection', (reason) => {
  logger.error('Воркер: необработанный отказ промиса, перезапуск', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Воркер: необработанное исключение, перезапуск', error);
  process.exit(1);
});

logger.info(`Процесс воркеров запущен (${env.NODE_ENV})`);

void startWorker(ordersJob);
