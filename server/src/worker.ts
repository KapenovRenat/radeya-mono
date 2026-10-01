import type { WorkerKey } from '@radeya/shared';

import { env } from './config/env';
import { logger } from './lib/logger';
import { startWorkers } from './modules/workers/engine/worker-engine';
import { WORKER_JOBS } from './modules/workers/jobs';

/**
 * Процесс воркеров — отдельно от API. Устройство — docs/workers.md.
 *
 *   npm run worker              — все воркеры из реестра (jobs/index.ts)
 *   npm run worker -- orders    — только указанные, через пробел
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

const allKeys = Object.keys(WORKER_JOBS) as WorkerKey[];
const requested = process.argv.slice(2).map((name) => name.toUpperCase());
const unknown = requested.filter((name) => !allKeys.includes(name as WorkerKey));

if (unknown.length > 0) {
  logger.error(`Неизвестные воркеры: ${unknown.join(', ')}. Есть: ${allKeys.join(', ').toLowerCase()}`);
  process.exit(1);
}

const keys = requested.length > 0 ? (requested as WorkerKey[]) : allKeys;

logger.info(`Процесс воркеров запущен (${env.NODE_ENV}): ${keys.join(', ')}`);

void startWorkers(keys.map((key) => WORKER_JOBS[key]));
