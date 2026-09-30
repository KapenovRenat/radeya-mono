import express, { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { can } from '../../middlewares/require-auth';
import { commitSuppliers, getSuppliers, patchSupplier, previewSuppliers } from './suppliers.controller';

const { ADMIN } = USER_ROLES;

/**
 * Поставщики. Список — всем вошедшим: он нужен фильтру каталога. Импорт
 * и правка — только ADMIN: это закупочная сторона дела и запись пачкой.
 */
export const suppliersRouter = Router();

// Весь модуль — только вошедшим. Маршрут без своего can() не станет публичным.
suppliersRouter.use(can());

suppliersRouter.get('/', can(), getSuppliers);

/**
 * Файл приезжает двоичным телом, а не multipart: поле у запроса одно,
 * и ради него тащить разбор форм с временными файлами незачем.
 *
 * Свой лимит вместо общего мегабайта: выгрузка контрагентов на пять с половиной
 * тысяч строк весит около мегабайта, но справочник растёт. Выше лимита запрос
 * отклоняется, не доходя до разбора.
 */
suppliersRouter.post(
  '/import/preview',
  can([ADMIN]),
  express.raw({ type: '*/*', limit: '25mb' }),
  previewSuppliers,
);

/** Запись: тело обычный JSON — строки, которые человек увидел в предпросмотре. */
suppliersRouter.post(
  '/import/commit',
  can([ADMIN]),
  express.json({ limit: '5mb' }),
  commitSuppliers,
);

suppliersRouter.patch('/:id', can([ADMIN]), patchSupplier);
