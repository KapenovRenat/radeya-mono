import { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { requireAuth, requireRole } from '../../middlewares/require-auth';
import { getSalesPoints, patchSalesPoint, postSalesPoint } from './sales-points.controller';

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

salesPointsRouter.use(requireAuth);

salesPointsRouter.get('/', getSalesPoints);
salesPointsRouter.post('/', requireRole(USER_ROLES.ADMIN), postSalesPoint);
salesPointsRouter.patch('/:id', requireRole(USER_ROLES.ADMIN), patchSalesPoint);
