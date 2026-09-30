import { Router } from 'express';

import { can } from '../../middlewares/require-auth';
import { login, logout, me } from './auth.controller';

/**
 * Маршруты входа. Регистрации нет: сотрудников заводит админ,
 * первый админ создаётся командой `npm run create:admin`.
 *
 * Модуль без общего `use(can())`: вход по определению идёт без сессии.
 */
export const authRouter = Router();

authRouter.post('/login', login);
authRouter.post('/logout', can(), logout);
authRouter.get('/me', can(), me);
