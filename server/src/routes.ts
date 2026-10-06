import { Router } from 'express';

import { auditRouter } from './modules/audit/audit.routes';
import { authRouter } from './modules/auth/auth.routes';
import { healthRouter } from './modules/health/health.routes';
import { importsRouter } from './modules/imports/imports.routes';
import { kaspiCabinetRouter } from './modules/kaspi-cabinet/kaspi-cabinet.routes';
import { kaspiCatalogRouter } from './modules/kaspi-catalog/kaspi-catalog.routes';
import { categoriesRouter } from './modules/categories/categories.routes';
import { dictionariesRouter } from './modules/dictionaries/dictionaries.routes';
import { ordersRouter } from './modules/orders/orders.routes';
import { productsRouter } from './modules/products/products.routes';
import { salesPointsRouter } from './modules/sales-points/sales-points.routes';
import { statsRouter } from './modules/stats/stats.routes';
import { stockDocumentsRouter } from './modules/stock-documents/stock-documents.routes';
import { suppliersRouter } from './modules/suppliers/suppliers.routes';
import { usersRouter } from './modules/users/users.routes';
import { warehousesRouter } from './modules/warehouses/warehouses.routes';
import { workersRouter } from './modules/workers/workers.routes';

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
apiRouter.use('/kaspi-cabinet', kaspiCabinetRouter);
apiRouter.use('/warehouses', warehousesRouter);
apiRouter.use('/products', productsRouter);
apiRouter.use('/categories', categoriesRouter);
apiRouter.use('/sales-points', salesPointsRouter);
apiRouter.use('/dictionaries', dictionariesRouter);
apiRouter.use('/imports', importsRouter);
apiRouter.use('/suppliers', suppliersRouter);
apiRouter.use('/stats', statsRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/workers', workersRouter);
apiRouter.use('/stock-documents', stockDocumentsRouter);
