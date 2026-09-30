import { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { requireAuth, requireRole } from '../../middlewares/require-auth';
import { getAccount, postCheck, putAccount } from './kaspi-cabinet.controller';

/**
 * Доступ в кабинет Kaspi. Только ADMIN: это ключи от магазина.
 *
 * Здесь только настройка и проверка. Сам вход выполняют те, кому нужен
 * кабинет, через withCabinetSession() — отдельного эндпоинта «войти» нет.
 */
export const kaspiCabinetRouter = Router();

kaspiCabinetRouter.use(requireAuth, requireRole(USER_ROLES.ADMIN));

kaspiCabinetRouter.get('/account', getAccount);
kaspiCabinetRouter.put('/account', putAccount);
kaspiCabinetRouter.post('/check', postCheck);
