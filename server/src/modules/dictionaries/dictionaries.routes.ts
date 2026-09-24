import { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { requireAuth, requireRole } from '../../middlewares/require-auth';
import { getDictionaries, patchDictionaryItem,
  postDictionaryItem } from './dictionaries.controller';

/**
 * Пополняемые списки офлайн-точки.
 *
 * Чтение — любому вошедшему: значения нужны в форме заказа и в фильтрах,
 * секрета в них нет. Добавление и правка — ADMIN и MANAGER: список пополняется
 * по ходу работы, и гонять админа ради нового способа оплаты незачем,
 * но и продавцу плодить строки в общем справочнике не стоит.
 *
 * Удаления нет: на значении висят заказы. Закрытие — `PATCH` с `isActive: false`.
 */
export const dictionariesRouter = Router();

dictionariesRouter.use(requireAuth);

dictionariesRouter.get('/', getDictionaries);
dictionariesRouter.post('/', requireRole(USER_ROLES.ADMIN, USER_ROLES.MANAGER), postDictionaryItem);
dictionariesRouter.patch('/:id', requireRole(USER_ROLES.ADMIN, USER_ROLES.MANAGER), patchDictionaryItem);
