import { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { requireAuth, requireRole } from '../../middlewares/require-auth';
import { getUsers, postUser } from './users.controller';

/**
 * Раздел «Аккаунты». Заводить сотрудников может только админ —
 * иначе менеджер выпишет себе роль ADMIN и обойдёт любые ограничения.
 *
 * Список видят и менеджеры: он нужен, чтобы понимать, кто за что отвечает.
 */
export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get('/', getUsers);
usersRouter.post('/', requireRole(USER_ROLES.ADMIN), postUser);
