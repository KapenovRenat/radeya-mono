import { Router } from 'express';
import { PERMISSIONS } from '@radeya/shared';

import { can } from '../../middlewares/require-auth';
import { getWarehouses, patchWarehouse, postKaspiWarehouses, postOwnWarehouse } from './warehouses.controller';


/**
 * Справочник складов. Список нужен всем — фильтр каталога и колонки складов.
 * Импорт — право KASPI_SYNC, свои склады — WAREHOUSES_MANAGE: ошибка тихо разъедется
 * по товарам и заказам.
 */
export const warehousesRouter = Router();

// Весь модуль — только вошедшим. Маршрут без своего can() не станет публичным.
warehousesRouter.use(can());

warehousesRouter.get('/', can(), getWarehouses);
warehousesRouter.post('/', can(PERMISSIONS.WAREHOUSES_MANAGE), postOwnWarehouse);
warehousesRouter.post('/import-kaspi', can(PERMISSIONS.KASPI_SYNC), postKaspiWarehouses);
warehousesRouter.patch('/:id', can(PERMISSIONS.WAREHOUSES_MANAGE), patchWarehouse);
