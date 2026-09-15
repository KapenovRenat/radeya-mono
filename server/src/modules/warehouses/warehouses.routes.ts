import { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { requireAuth, requireRole } from '../../middlewares/require-auth';
import { getWarehouses, postKaspiWarehouses } from './warehouses.controller';

/**
 * Справочник складов — только для админа: это настройка учёта, а не рабочий
 * экран. Ошибка здесь тихо разъедется по товарам и заказам.
 */
export const warehousesRouter = Router();

warehousesRouter.use(requireAuth, requireRole(USER_ROLES.ADMIN));

warehousesRouter.get('/', getWarehouses);
warehousesRouter.post('/import-kaspi', postKaspiWarehouses);
