import { Router } from 'express';
import { PERMISSIONS } from '@radeya/shared';

import { can } from '../../middlewares/require-auth';
import { getKaspiOrders, getOrder, getOrderComments, getOrders, postOrderComment,
  postSyncKaspiOrders, postSyncOrderCabinet, postSyncOrderEntries,
  postSyncOrdersCabinet } from './orders.controller';


/**
 * Заказы. Смотреть и комментировать — всем вошедшим, это рабочий экран.
 * Синхронизация с Kaspi пишет в базу пачкой — только тем, кто за неё отвечает.
 */
export const ordersRouter = Router();

// Весь модуль — только вошедшим. Маршрут без своего can() не станет публичным.
ordersRouter.use(can());

ordersRouter.get('/', can(PERMISSIONS.ORDERS_VIEW), getOrders);
// Строго до '/:id/...': иначе «kaspi» и «sync» попали бы в параметр заказа.
// Сырьё Kaspi для сверки статусов — отладка, не рабочий экран.
ordersRouter.get('/kaspi', can(PERMISSIONS.ORDERS_KASPI_DEBUG), getKaspiOrders);
ordersRouter.post('/sync', can(PERMISSIONS.ORDERS_SYNC), postSyncKaspiOrders);
// Дата прибытия из кабинета для активных заказов — следом за синхронизацией кнопкой.
ordersRouter.post('/cabinet/sync', can(PERMISSIONS.ORDERS_SYNC), postSyncOrdersCabinet);
ordersRouter.get('/:id', can(PERMISSIONS.ORDERS_VIEW), getOrder);
// Срабатывают сами при открытии заказа Kaspi — значит, у всех, кто его открывает.
ordersRouter.post('/:id/entries/sync', can(PERMISSIONS.ORDERS_VIEW), postSyncOrderEntries);
ordersRouter.post('/:id/cabinet/sync', can(PERMISSIONS.ORDERS_VIEW), postSyncOrderCabinet);
ordersRouter.get('/:id/comments', can(PERMISSIONS.ORDERS_VIEW), getOrderComments);
ordersRouter.post('/:id/comments', can(PERMISSIONS.ORDERS_COMMENT), postOrderComment);
