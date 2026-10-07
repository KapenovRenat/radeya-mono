import express, { Router } from 'express';
import { PERMISSIONS } from '@radeya/shared';

import { can } from '../../middlewares/require-auth';
import { fetchCatalog, previewCatalog } from './kaspi-catalog.controller';


/**
 * Синхронизация с Kaspi. Только для админа: это управление каталогом,
 * а не просмотр.
 */
export const kaspiCatalogRouter = Router();

// Весь модуль — только вошедшим. Маршрут без своего can() не станет публичным.
kaspiCatalogRouter.use(can());

kaspiCatalogRouter.post(
  '/preview',
  can(PERMISSIONS.KASPI_SYNC),
  // Свой разбор тела с увеличенным лимитом: две выгрузки — это ~650 КБ,
  // а общий лимит приложения намеренно оставлен в 1 МБ.
  express.json({ limit: '20mb' }),
  previewCatalog,
);

// Обход каталога в кабинете. Тело маленькое (кука и пара флагов),
// поэтому общего лимита приложения хватает.
kaspiCatalogRouter.post('/fetch', can(PERMISSIONS.KASPI_SYNC), fetchCatalog);
