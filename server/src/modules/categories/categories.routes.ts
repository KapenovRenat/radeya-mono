import { Router } from 'express';
import { PERMISSIONS } from '@radeya/shared';
import { can } from '../../middlewares/require-auth';
import { getCategories, postCategory, patchCategory, patchCategoriesOrder,
  removeCategory } from './categories.controller';


/** Папки каталога. Дерево — право CATALOG_VIEW, правка — CATALOG_EDIT_FOLDERS. */
export const categoriesRouter = Router();

// Весь модуль — только вошедшим. Маршрут без своего can() не станет публичным.
categoriesRouter.use(can());

categoriesRouter.get('/', can(PERMISSIONS.CATALOG_VIEW), getCategories);
categoriesRouter.post('/', can(PERMISSIONS.CATALOG_EDIT_FOLDERS), postCategory);
// Строго до '/:id': иначе «order» попадёт в параметр и уедет в переименование.
categoriesRouter.patch('/order', can(PERMISSIONS.CATALOG_EDIT_FOLDERS), patchCategoriesOrder);
categoriesRouter.patch('/:id', can(PERMISSIONS.CATALOG_EDIT_FOLDERS), patchCategory);
categoriesRouter.delete('/:id', can(PERMISSIONS.CATALOG_EDIT_FOLDERS), removeCategory);
