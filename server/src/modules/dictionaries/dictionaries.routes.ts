import { Router } from 'express';
import { PERMISSIONS } from '@radeya/shared';

import { can } from '../../middlewares/require-auth';
import { getDictionaries, patchDictionaryItem,
  postDictionaryItem } from './dictionaries.controller';


/**
 * Пополняемые списки офлайн-точки.
 *
 * Чтение — любому вошедшему: значения нужны в форме заказа и в фильтрах,
 * секрета в них нет. Добавление и правка — право DICTIONARIES_EDIT: список пополняется
 * по ходу работы, и гонять админа ради нового способа оплаты незачем,
 * но и продавцу плодить строки в общем справочнике не стоит.
 *
 * Удаления нет: на значении висят заказы. Закрытие — `PATCH` с `isActive: false`.
 */
export const dictionariesRouter = Router();

// Весь модуль — только вошедшим. Маршрут без своего can() не станет публичным.
dictionariesRouter.use(can());

dictionariesRouter.get('/', can(), getDictionaries);
dictionariesRouter.post('/', can(PERMISSIONS.DICTIONARIES_EDIT), postDictionaryItem);
dictionariesRouter.patch('/:id', can(PERMISSIONS.DICTIONARIES_EDIT), patchDictionaryItem);
