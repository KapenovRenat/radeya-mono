import { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { requireAuth, requireRole } from '../../middlewares/require-auth';
import { getKaspiOrders, getOrders, postSyncKaspiOrders } from './orders.controller';

/**
 * Заказы. Пока только чтение из Kaspi с разбором в нашу модель, без записи.
 *
 * Роль ADMIN на весь модуль: запрос ходит под токеном магазина и тянет
 * персональные данные покупателей — имена, телефоны, адреса.
 */
export const ordersRouter = Router();

ordersRouter.use(requireAuth, requireRole(USER_ROLES.ADMIN));

ordersRouter.get('/', getOrders);
ordersRouter.get('/kaspi', getKaspiOrders);
ordersRouter.post('/sync', postSyncKaspiOrders);
