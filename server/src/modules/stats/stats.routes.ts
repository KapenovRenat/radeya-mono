import { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { requireAuth, requireRole } from '../../middlewares/require-auth';
import { getOrdersStats } from './stats.controller';

/**
 * Статистика. ADMIN, как и сам реестр заказов: выручка по точкам и доля
 * возвратов — не те цифры, которые нужны каждому продавцу.
 */
export const statsRouter = Router();

statsRouter.use(requireAuth, requireRole(USER_ROLES.ADMIN));

statsRouter.get('/orders', getOrdersStats);
