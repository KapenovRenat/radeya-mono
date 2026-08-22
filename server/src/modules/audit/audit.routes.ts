import { Router } from 'express';
import { USER_ROLES } from '@radeya/shared';

import { requireAuth, requireRole } from '../../middlewares/require-auth';
import { getAuditLog } from './audit.controller';

/**
 * Журнал действий. Только чтение и только для админа: по записям видно,
 * кто чем занимается, и рядовому сотруднику это знать незачем.
 *
 * Эндпоинтов на изменение и удаление нет и не будет — журнал,
 * который можно править, журналом не является.
 */
export const auditRouter = Router();

auditRouter.get('/', requireAuth, requireRole(USER_ROLES.ADMIN), getAuditLog);
