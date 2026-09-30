import { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { can } from '../../middlewares/require-auth';
import { getKaspiOrders, getOrder, getOrderComments, getOrders, postOrderComment,
  postSyncKaspiOrders, postSyncOrderEntries } from './orders.controller';

const { ADMIN, MANAGER } = USER_ROLES;

/**
 * Заказы. Смотреть и комментировать — всем вошедшим, это рабочий экран.
 * Синхронизация с Kaspi пишет в базу пачкой — только тем, кто за неё отвечает.
 */
export const ordersRouter = Router();

// Весь модуль — только вошедшим. Маршрут без своего can() не станет публичным.
ordersRouter.use(can());

ordersRouter.get('/', can(), getOrders);
// Строго до '/:id/...': иначе «kaspi» и «sync» попали бы в параметр заказа.
// Сырьё Kaspi для сверки статусов — отладка, не рабочий экран.
ordersRouter.get('/kaspi', can([ADMIN]), getKaspiOrders);
ordersRouter.post('/sync', can([ADMIN, MANAGER]), postSyncKaspiOrders);
ordersRouter.get('/:id', can(), getOrder);
// Срабатывает сам при первом открытии заказа Kaspi — значит, у всех, кто его открывает.
ordersRouter.post('/:id/entries/sync', can(), postSyncOrderEntries);
ordersRouter.get('/:id/comments', can(), getOrderComments);
ordersRouter.post('/:id/comments', can(), postOrderComment);
