import { Router } from 'express';

import { requireAuth } from '../../middlewares/require-auth';
import { login, logout, me } from './auth.controller';

/**
 * Маршруты входа. Регистрации нет: сотрудников заводит админ,
 * первый админ создаётся командой `npm run create:admin`.
 */
export const authRouter = Router();

authRouter.post('/login', login);
authRouter.post('/logout', requireAuth, logout);
authRouter.get('/me', requireAuth, me);
