import { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { can } from '../../middlewares/require-auth';
import { getAccount, postCheck, putAccount } from './kaspi-cabinet.controller';

const { ADMIN } = USER_ROLES;

/**
 * Доступ в кабинет Kaspi. Только ADMIN: это ключи от магазина.
 *
 * Здесь только настройка и проверка. Сам вход выполняют те, кому нужен
 * кабинет, через withCabinetSession() — отдельного эндпоинта «войти» нет.
 */
export const kaspiCabinetRouter = Router();

// Весь модуль — только вошедшим. Маршрут без своего can() не станет публичным.
kaspiCabinetRouter.use(can());

kaspiCabinetRouter.get('/account', can([ADMIN]), getAccount);
kaspiCabinetRouter.put('/account', can([ADMIN]), putAccount);
kaspiCabinetRouter.post('/check', can([ADMIN]), postCheck);
