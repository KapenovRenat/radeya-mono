import { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';
import { requireAuth, requireRole } from '../../middlewares/require-auth';
import { getCategories, postCategory } from './categories.controller';

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth, requireRole(USER_ROLES.ADMIN));
categoriesRouter.get('/', getCategories);
categoriesRouter.post('/', postCategory);
