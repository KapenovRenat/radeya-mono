import { Router } from 'express';
import { PERMISSIONS } from '@radeya/shared';

import { can } from '../../middlewares/require-auth';
import { getSalesPoints, patchSalesPoint, postSalesPoint } from './sales-points.controller';


/**
 * Точки продаж.
 *
 * Чтение доступно любому вошедшему: справочник нужен в фильтре реестра заказов
 * и в выпадашке при вводе офлайн-заказа, а секрета в названиях точек нет.
 * Запись — право SALES_POINTS_MANAGE: точка продаж это разрез всей статистики, и заводить
 * её должен тот, кто отвечает за отчётность.
 *
 * Удаления нет: на точке висят заказы. Закрытие — `PATCH` с `isActive: false`.
 */
export const salesPointsRouter = Router();

// Весь модуль — только вошедшим. Маршрут без своего can() не станет публичным.
salesPointsRouter.use(can());

salesPointsRouter.get('/', can(), getSalesPoints);
salesPointsRouter.post('/', can(PERMISSIONS.SALES_POINTS_MANAGE), postSalesPoint);
salesPointsRouter.patch('/:id', can(PERMISSIONS.SALES_POINTS_MANAGE), patchSalesPoint);
