import { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { can } from '../../middlewares/require-auth';
import { getSalesPoints, patchSalesPoint, postSalesPoint } from './sales-points.controller';

const { ADMIN } = USER_ROLES;

/**
 * Точки продаж.
 *
 * Чтение доступно любому вошедшему: справочник нужен в фильтре реестра заказов
 * и в выпадашке при вводе офлайн-заказа, а секрета в названиях точек нет.
 * Запись — только ADMIN: точка продаж это разрез всей статистики, и заводить
 * её должен тот, кто отвечает за отчётность.
 *
 * Удаления нет: на точке висят заказы. Закрытие — `PATCH` с `isActive: false`.
 */
export const salesPointsRouter = Router();

// Весь модуль — только вошедшим. Маршрут без своего can() не станет публичным.
salesPointsRouter.use(can());

salesPointsRouter.get('/', can(), getSalesPoints);
salesPointsRouter.post('/', can([ADMIN]), postSalesPoint);
salesPointsRouter.patch('/:id', can([ADMIN]), patchSalesPoint);
