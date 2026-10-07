import { Router } from 'express';
import { PERMISSIONS } from '@radeya/shared';

import { can } from '../../middlewares/require-auth';
import { getOrdersStats } from './stats.controller';

/**
 * Статистика — право STATS_VIEW.
 */
export const statsRouter = Router();

// Весь модуль — только вошедшим. Маршрут без своего can() не станет публичным.
statsRouter.use(can());

statsRouter.get('/orders', can(PERMISSIONS.STATS_VIEW), getOrdersStats);
