import { Router } from 'express';
import { PERMISSIONS } from '@radeya/shared';

import { can } from '../../middlewares/require-auth';
import { getUsers, patchUser, postUser, removeUser } from './users.controller';

/**
 * Сотрудники и их права — право USERS_MANAGE (админу — всегда).
 *
 * Это ключ от всей системы: кто раздаёт права, тот может раздать их и себе
 * через сообщника. Поэтому не-админ с этим правом ограничен в сервисе —
 * выдаёт только свои права и не трогает админов (users.service.ts).
 */
export const usersRouter = Router();

usersRouter.use(can(PERMISSIONS.USERS_MANAGE));

usersRouter.get('/', can(PERMISSIONS.USERS_MANAGE), getUsers);
usersRouter.post('/', can(PERMISSIONS.USERS_MANAGE), postUser);
usersRouter.patch('/:id', can(PERMISSIONS.USERS_MANAGE), patchUser);
usersRouter.delete('/:id', can(PERMISSIONS.USERS_MANAGE), removeUser);
