import { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { can } from '../../middlewares/require-auth';
import { getWorkerEvents, getWorkers, postTestCard, putWorkerSettings } from './workers.controller';

const { ADMIN } = USER_ROLES;

/**
 * Воркеры — настройки и состояние. Только ADMIN: включение воркера пускает
 * автоматическую отправку поставщикам.
 */
export const workersRouter = Router();

// Весь модуль — только вошедшим. Маршрут без своего can() не станет публичным.
workersRouter.use(can());

workersRouter.get('/', can([ADMIN]), getWorkers);
// Строго до '/:key/...': иначе «orders» ушло бы в параметр.
workersRouter.post('/orders/test-card', can([ADMIN]), postTestCard);
workersRouter.get('/:key/events', can([ADMIN]), getWorkerEvents);
workersRouter.put('/:key/settings', can([ADMIN]), putWorkerSettings);
