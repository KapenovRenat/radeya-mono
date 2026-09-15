import express, { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { requireAuth, requireRole } from '../../middlewares/require-auth';
import { fetchCatalog, previewCatalog } from './kaspi-catalog.controller';

/**
 * Синхронизация с Kaspi. Только для админа: это управление каталогом,
 * а не просмотр.
 */
export const kaspiCatalogRouter = Router();

kaspiCatalogRouter.post(
  '/preview',
  requireAuth,
  requireRole(USER_ROLES.ADMIN),
  // Свой разбор тела с увеличенным лимитом: две выгрузки — это ~650 КБ,
  // а общий лимит приложения намеренно оставлен в 1 МБ.
  express.json({ limit: '20mb' }),
  previewCatalog,
);

// Обход каталога в кабинете. Тело маленькое (кука и пара флагов),
// поэтому общего лимита приложения хватает.
kaspiCatalogRouter.post(
  '/fetch',
  requireAuth,
  requireRole(USER_ROLES.ADMIN),
  fetchCatalog,
);
