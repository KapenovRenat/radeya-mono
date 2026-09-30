import { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { can } from '../../middlewares/require-auth';
import { getUsers, postUser } from './users.controller';

const { ADMIN } = USER_ROLES;

/**
 * Раздел «Аккаунты» — только админ.
 *
 * Заводить сотрудников иначе нельзя: менеджер выпишет себе роль ADMIN
 * и обойдёт любые ограничения. Список закрыт по тому же принципу —
 * состав команды с ролями и должностями рядовому сотруднику знать незачем.
 */
export const usersRouter = Router();

// Весь модуль — только вошедшим. Маршрут без своего can() не станет публичным.
usersRouter.use(can());

usersRouter.get('/', can([ADMIN]), getUsers);
usersRouter.post('/', can([ADMIN]), postUser);
