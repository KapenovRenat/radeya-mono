import express, { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { requireAuth, requireRole } from '../../middlewares/require-auth';
import { getKnownSkus, postImportKaspiProducts } from './products.controller';
import { getCatalog, patchProductsCategory } from './catalog.controller';
import { commitMoysklad, commitStock, previewMoysklad, previewStock } from './moysklad.controller';

/**
 * Каталог. Пока закрыт ролью ADMIN целиком: заполнение каталога — настройка
 * учёта, а не рабочий экран. Роли менеджера появятся, когда появится карточка
 * товара с ежедневной работой.
 */
export const productsRouter = Router();

productsRouter.use(requireAuth, requireRole(USER_ROLES.ADMIN));

productsRouter.get('/skus', getKnownSkus);
productsRouter.get('/variants', getCatalog);
productsRouter.patch('/category', patchProductsCategory);

// Весь каталог целиком сюда не присылают: полторы тысячи товаров с картинками
// и историей изменений — это около пяти мегабайт, а общий лимит тела намеренно
// оставлен в 1 МБ. Клиент шлёт пачками, поэтому свой лимит на маршруте не нужен:
// он всё равно не сработал бы — express.json приложения разбирает тело раньше.
productsRouter.post('/import-kaspi', postImportKaspiProducts);

/**
 * Импорт закупки, поставщиков и сроков предзаказа из выгрузки МойСклада.
 *
 * Файл приезжает двоичным телом, а не multipart: поле у запроса одно.
 * Свой лимит вместо общего мегабайта — выгрузка номенклатуры на девяносто
 * колонок весит несколько мегабайт.
 */
productsRouter.post(
  '/moysklad/preview',
  express.raw({ type: '*/*', limit: '25mb' }),
  previewMoysklad,
);

/** Запись: тело JSON — строки, которые человек увидел в предпросмотре. */
productsRouter.post(
  '/moysklad/commit',
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
  express.raw({ type: '*/*', limit: '25mb' }),
  previewStock,
);

productsRouter.post(
  '/moysklad/stock/commit',
  express.json({ limit: '25mb' }),
  commitStock,
);
