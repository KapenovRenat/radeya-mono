import { Router } from 'express';
import { PERMISSIONS } from '@radeya/shared';

import { can } from '../../middlewares/require-auth';
import { getAccount, postCheck, putAccount } from './kaspi-cabinet.controller';


/**
 * Доступ в кабинет Kaspi. Право KASPI_CABINET_MANAGE: это ключи от магазина.
 *
 * Здесь только настройка и проверка. Сам вход выполняют те, кому нужен
 * кабинет, через withCabinetSession() — отдельного эндпоинта «войти» нет.
 */
export const kaspiCabinetRouter = Router();

// Весь модуль — только вошедшим. Маршрут без своего can() не станет публичным.
kaspiCabinetRouter.use(can());

kaspiCabinetRouter.get('/account', can(PERMISSIONS.KASPI_CABINET_MANAGE), getAccount);
kaspiCabinetRouter.put('/account', can(PERMISSIONS.KASPI_CABINET_MANAGE), putAccount);
kaspiCabinetRouter.post('/check', can(PERMISSIONS.KASPI_CABINET_MANAGE), postCheck);
