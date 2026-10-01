import { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { can } from '../../middlewares/require-auth';
import { getWorkers, putWorkerSettings } from './workers.controller';

const { ADMIN } = USER_ROLES;

/**
 * Воркеры — настройки и состояние. Только ADMIN: включение воркера пускает
 * автоматическую отправку поставщикам.
 */
export const workersRouter = Router();

// Весь модуль — только вошедшим. Маршрут без своего can() не станет публичным.
workersRouter.use(can());

workersRouter.get('/', can([ADMIN]), getWorkers);
workersRouter.put('/:key/settings', can([ADMIN]), putWorkerSettings);
