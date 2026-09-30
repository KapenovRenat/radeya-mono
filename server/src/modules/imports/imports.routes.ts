import express, { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { can } from '../../middlewares/require-auth';
import { commitOfflineOrders, previewOfflineOrders } from './imports.controller';

const { ADMIN } = USER_ROLES;

/**
 * Импорт данных из файлов. Только ADMIN: это запись в заказы пачкой,
 * и ошибка здесь стоит дороже, чем в любой форме.
 */
export const importsRouter = Router();

// Весь модуль — только вошедшим. Маршрут без своего can() не станет публичным.
importsRouter.use(can());

/**
 * Файл приезжает двоичным телом, а не multipart: полей у запроса всего два,
 * и ради них тащить разбор форм с временными файлами на диске незачем.
 *
 * Свой лимит вместо общего мегабайта: рабочая книга продаж весит около четырёх.
 * Выше него запрос отклоняется, не доходя до разбора, — книга на сотню
 * мегабайт положила бы процесс на распаковке.
 */
importsRouter.post(
  '/offline-orders/preview',
  can([ADMIN]),
  express.raw({ type: '*/*', limit: '25mb' }),
  previewOfflineOrders,
);

/** Запись: здесь тело обычный JSON — строки, которые человек увидел в предпросмотре. */
importsRouter.post(
  '/offline-orders/commit',
  can([ADMIN]),
  express.json({ limit: '25mb' }),
  commitOfflineOrders,
);
