import express, { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { can } from '../../middlewares/require-auth';
import { fetchCatalog, previewCatalog } from './kaspi-catalog.controller';

const { ADMIN } = USER_ROLES;

/**
 * Синхронизация с Kaspi. Только для админа: это управление каталогом,
 * а не просмотр.
 */
export const kaspiCatalogRouter = Router();

// Весь модуль — только вошедшим. Маршрут без своего can() не станет публичным.
kaspiCatalogRouter.use(can());

kaspiCatalogRouter.post(
  '/preview',
  can([ADMIN]),
  // Свой разбор тела с увеличенным лимитом: две выгрузки — это ~650 КБ,
  // а общий лимит приложения намеренно оставлен в 1 МБ.
  express.json({ limit: '20mb' }),
  previewCatalog,
);

// Обход каталога в кабинете. Тело маленькое (кука и пара флагов),
// поэтому общего лимита приложения хватает.
kaspiCatalogRouter.post('/fetch', can([ADMIN]), fetchCatalog);
