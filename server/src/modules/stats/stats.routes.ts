import { Router } from 'express';

import { can } from '../../middlewares/require-auth';
import { getOrdersStats } from './stats.controller';

/**
 * Статистика — всем вошедшим. Выручка по точкам видна всем; закрыть —
 * перечислить роли в can().
 */
export const statsRouter = Router();

// Весь модуль — только вошедшим. Маршрут без своего can() не станет публичным.
statsRouter.use(can());

statsRouter.get('/orders', can(), getOrdersStats);
