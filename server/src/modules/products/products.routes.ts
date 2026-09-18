import { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { requireAuth, requireRole } from '../../middlewares/require-auth';
import { getKnownSkus, postImportKaspiProducts } from './products.controller';
import { getCatalog, patchProductsCategory } from './catalog.controller';

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
