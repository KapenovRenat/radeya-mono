import express, { Router } from 'express';
import { PERMISSIONS } from '@radeya/shared';

import { can } from '../../middlewares/require-auth';
import { commitSuppliers, getSuppliers, patchSupplier, previewSuppliers } from './suppliers.controller';


/**
 * Поставщики. Список — всем вошедшим: он нужен фильтру каталога. Импорт
 * и правка — права IMPORTS и SUPPLIERS_EDIT: это закупочная сторона дела и запись пачкой.
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
  can(PERMISSIONS.IMPORTS),
  express.raw({ type: '*/*', limit: '25mb' }),
  previewSuppliers,
);

/** Запись: тело обычный JSON — строки, которые человек увидел в предпросмотре. */
suppliersRouter.post(
  '/import/commit',
  can(PERMISSIONS.IMPORTS),
  express.json({ limit: '5mb' }),
  commitSuppliers,
);

suppliersRouter.patch('/:id', can(PERMISSIONS.SUPPLIERS_EDIT), patchSupplier);
