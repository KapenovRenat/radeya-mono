import express, { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { can } from '../../middlewares/require-auth';
import { getKnownSkus, postImportKaspiProducts } from './products.controller';
import { getCatalog, patchProductsCategory } from './catalog.controller';
import { commitMoysklad, commitStock, previewMoysklad, previewStock } from './moysklad.controller';

const { ADMIN, MANAGER } = USER_ROLES;

/**
 * Каталог. Список — всем вошедшим; закупка и себестоимость в нём срезаются
 * по ролям (CATALOG_PURCHASE_ROLES, CATALOG_COST_ROLES). Импорты — только ADMIN:
 * это запись пачкой в весь каталог.
 */
export const productsRouter = Router();

// Весь модуль — только вошедшим. Маршрут без своего can() не станет публичным.
productsRouter.use(can());

// Артикулы в базе — для панели сохранения товаров из Kaspi, она только у ADMIN.
productsRouter.get('/skus', can([ADMIN]), getKnownSkus);
productsRouter.get('/variants', can(), getCatalog);
productsRouter.patch('/category', can([ADMIN, MANAGER]), patchProductsCategory);

// Весь каталог целиком сюда не присылают: полторы тысячи товаров с картинками
// и историей изменений — это около пяти мегабайт, а общий лимит тела намеренно
// оставлен в 1 МБ. Клиент шлёт пачками, поэтому свой лимит на маршруте не нужен:
// он всё равно не сработал бы — express.json приложения разбирает тело раньше.
productsRouter.post('/import-kaspi', can([ADMIN]), postImportKaspiProducts);

/**
 * Импорт закупки, поставщиков и сроков предзаказа из выгрузки МойСклада.
 *
 * Файл приезжает двоичным телом, а не multipart: поле у запроса одно.
 * Свой лимит вместо общего мегабайта — выгрузка номенклатуры на девяносто
 * колонок весит несколько мегабайт.
 */
productsRouter.post(
  '/moysklad/preview',
  can([ADMIN]),
  express.raw({ type: '*/*', limit: '25mb' }),
  previewMoysklad,
);

/** Запись: тело JSON — строки, которые человек увидел в предпросмотре. */
productsRouter.post(
  '/moysklad/commit',
  can([ADMIN]),
  express.json({ limit: '25mb' }),
  commitMoysklad,
);

/**
 * Импорт остатков из отчёта «Остатки» — один склад за раз, склад в `?warehouseId=`.
 * Отчёт весит сотни килобайт, но лимит тот же, что у выгрузки товаров:
 * склад с тысячей позиций вырастет в разы.
 */
productsRouter.post(
  '/moysklad/stock/preview',
  can([ADMIN]),
  express.raw({ type: '*/*', limit: '25mb' }),
  previewStock,
);

productsRouter.post(
  '/moysklad/stock/commit',
  can([ADMIN]),
  express.json({ limit: '25mb' }),
  commitStock,
);
