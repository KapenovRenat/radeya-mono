import { Router } from 'express';
import { PERMISSIONS } from '@radeya/shared';

import { can } from '../../middlewares/require-auth';
import { getWorkerEvents, getWorkers, postTestCard, putWorkerSettings } from './workers.controller';


/**
 * Воркеры — настройки и состояние. Право WORKERS_MANAGE: включение воркера пускает
 * автоматическую отправку поставщикам.
 */
export const workersRouter = Router();

// Весь модуль — только вошедшим. Маршрут без своего can() не станет публичным.
workersRouter.use(can());

workersRouter.get('/', can(PERMISSIONS.WORKERS_MANAGE), getWorkers);
// Строго до '/:key/...': иначе «orders» ушло бы в параметр.
workersRouter.post('/orders/test-card', can(PERMISSIONS.WORKERS_MANAGE), postTestCard);
workersRouter.get('/:key/events', can(PERMISSIONS.WORKERS_MANAGE), getWorkerEvents);
workersRouter.put('/:key/settings', can(PERMISSIONS.WORKERS_MANAGE), putWorkerSettings);
