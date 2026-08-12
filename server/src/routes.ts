import { Router } from 'express';

import { healthRouter } from './modules/health/health.routes';

/**
 * Единственное место, где модули подключаются к API.
 * Новый модуль — одна строка здесь и своя папка в src/modules/.
 */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
