import { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';
import { can } from '../../middlewares/require-auth';
import { getCategories, postCategory, patchCategory, patchCategoriesOrder,
  removeCategory } from './categories.controller';

const { ADMIN, MANAGER } = USER_ROLES;

/** Папки каталога. Дерево видят все вошедшие, правят — ADMIN и MANAGER. */
export const categoriesRouter = Router();

// Весь модуль — только вошедшим. Маршрут без своего can() не станет публичным.
categoriesRouter.use(can());

categoriesRouter.get('/', can(), getCategories);
categoriesRouter.post('/', can([ADMIN, MANAGER]), postCategory);
// Строго до '/:id': иначе «order» попадёт в параметр и уедет в переименование.
categoriesRouter.patch('/order', can([ADMIN, MANAGER]), patchCategoriesOrder);
categoriesRouter.patch('/:id', can([ADMIN, MANAGER]), patchCategory);
categoriesRouter.delete('/:id', can([ADMIN, MANAGER]), removeCategory);
