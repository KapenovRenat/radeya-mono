import { Router } from 'express';

import { auditRouter } from './modules/audit/audit.routes';
import { authRouter } from './modules/auth/auth.routes';
import { healthRouter } from './modules/health/health.routes';
import { kaspiCatalogRouter } from './modules/kaspi-catalog/kaspi-catalog.routes';
import { productsRouter } from './modules/products/products.routes';
import { usersRouter } from './modules/users/users.routes';
import { warehousesRouter } from './modules/warehouses/warehouses.routes';

/**
 * Единственное место, где модули подключаются к API.
 * Новый модуль — одна строка здесь и своя папка в src/modules/.
 */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/audit', auditRouter);
apiRouter.use('/kaspi-catalog', kaspiCatalogRouter);
apiRouter.use('/warehouses', warehousesRouter);
apiRouter.use('/products', productsRouter);
