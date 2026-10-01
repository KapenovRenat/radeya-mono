import type { WorkerKey } from '@radeya/shared';

import type { WorkerJob } from '../engine/worker-engine';
import { ordersJob } from './orders/orders.job';

/**
 * Реестр воркеров. Новый воркер:
 *   1. ключ в WORKER_KEYS и название в WORKER_TITLES (shared/src/constants/workers.ts);
 *   2. папка `jobs/<имя>/` со своим `<имя>.job.ts`;
 *   3. строка здесь.
 * Его карточка в «Настройках → Воркеры» появится сама.
 *
 * Record по всем ключам: заведённый в shared ключ без воркера здесь не соберётся.
 */
export const WORKER_JOBS: Record<WorkerKey, WorkerJob> = {
  ORDERS: ordersJob,
};
