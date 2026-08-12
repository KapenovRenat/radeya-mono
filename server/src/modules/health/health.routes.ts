import { Router } from 'express';

import { healthCheck } from './health.controller';

/**
 * Маршруты модуля. Файл тонкий: путь + мидлвары + контроллер, ничего больше.
 */
export const healthRouter = Router();

healthRouter.get('/', healthCheck);
