import { Router } from 'express';

import { auditRouter } from './modules/audit/audit.routes';
import { authRouter } from './modules/auth/auth.routes';
import { healthRouter } from './modules/health/health.routes';
import { usersRouter } from './modules/users/users.routes';

/**
 * Единственное место, где модули подключаются к API.
 * Новый модуль — одна строка здесь и своя папка в src/modules/.
 */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/audit', auditRouter);
