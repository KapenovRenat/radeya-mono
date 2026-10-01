import { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { can } from '../../middlewares/require-auth';
import { getWarehouses, patchWarehouse, postKaspiWarehouses } from './warehouses.controller';

const { ADMIN } = USER_ROLES;

/**
 * Справочник складов. Список нужен всем — фильтр каталога и колонки складов.
 * Импорт — только ADMIN: это настройка учёта, ошибка тихо разъедется
 * по товарам и заказам.
 */
export const warehousesRouter = Router();

// Весь модуль — только вошедшим. Маршрут без своего can() не станет публичным.
warehousesRouter.use(can());

warehousesRouter.get('/', can(), getWarehouses);
warehousesRouter.post('/import-kaspi', can([ADMIN]), postKaspiWarehouses);
warehousesRouter.patch('/:id', can([ADMIN]), patchWarehouse);
