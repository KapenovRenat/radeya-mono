import { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { requireAuth, requireRole } from '../../middlewares/require-auth';
import { getKaspiOrders, getOrder, getOrderComments, getOrders, postOrderComment,
  postSyncKaspiOrders, postSyncOrderEntries } from './orders.controller';

/**
 * Заказы. Пока только чтение из Kaspi с разбором в нашу модель, без записи.
 *
 * Роль ADMIN на весь модуль: запрос ходит под токеном магазина и тянет
 * персональные данные покупателей — имена, телефоны, адреса.
 */
export const ordersRouter = Router();

ordersRouter.use(requireAuth, requireRole(USER_ROLES.ADMIN));

ordersRouter.get('/', getOrders);
// Строго до '/:id/...': иначе «kaspi» и «sync» попали бы в параметр заказа.
ordersRouter.get('/kaspi', getKaspiOrders);
ordersRouter.post('/sync', postSyncKaspiOrders);
ordersRouter.get('/:id', getOrder);
ordersRouter.post('/:id/entries/sync', postSyncOrderEntries);
ordersRouter.get('/:id/comments', getOrderComments);
ordersRouter.post('/:id/comments', postOrderComment);
