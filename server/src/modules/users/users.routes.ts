import { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { requireAuth, requireRole } from '../../middlewares/require-auth';
import { getUsers, postUser } from './users.controller';

/**
 * Раздел «Аккаунты» — целиком для админа.
 *
 * Заводить сотрудников иначе нельзя: менеджер выпишет себе роль ADMIN
 * и обойдёт любые ограничения. Список закрыт по тому же принципу —
 * состав команды с ролями и должностями рядовому сотруднику знать незачем,
 * а раздел в интерфейсе всё равно доступен только админу.
 */
export const usersRouter = Router();

usersRouter.use(requireAuth, requireRole(USER_ROLES.ADMIN));

usersRouter.get('/', getUsers);
usersRouter.post('/', postUser);
