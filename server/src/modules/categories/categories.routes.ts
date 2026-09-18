import { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';
import { requireAuth, requireRole } from '../../middlewares/require-auth';
import { getCategories, postCategory, patchCategory, patchCategoriesOrder,
  removeCategory } from './categories.controller';

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth, requireRole(USER_ROLES.ADMIN));
categoriesRouter.get('/', getCategories);
categoriesRouter.post('/', postCategory);
// Строго до '/:id': иначе «order» попадёт в параметр и уедет в переименование.
categoriesRouter.patch('/order', patchCategoriesOrder);
categoriesRouter.patch('/:id', patchCategory);
categoriesRouter.delete('/:id', removeCategory);
