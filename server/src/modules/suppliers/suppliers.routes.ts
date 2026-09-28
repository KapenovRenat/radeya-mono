import express, { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { requireAuth, requireRole } from '../../middlewares/require-auth';
import { commitSuppliers, getSuppliers, patchSupplier, previewSuppliers } from './suppliers.controller';

/**
 * Поставщики. Только ADMIN: это закупочная сторона дела, продавцу она не нужна,
 * а импорт — запись в справочник пачкой.
 */
export const suppliersRouter = Router();

suppliersRouter.use(requireAuth, requireRole(USER_ROLES.ADMIN));

suppliersRouter.get('/', getSuppliers);

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
  express.raw({ type: '*/*', limit: '25mb' }),
  previewSuppliers,
);

/** Запись: тело обычный JSON — строки, которые человек увидел в предпросмотре. */
suppliersRouter.post(
  '/import/commit',
  express.json({ limit: '5mb' }),
  commitSuppliers,
);

suppliersRouter.patch('/:id', patchSupplier);
