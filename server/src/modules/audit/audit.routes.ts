import { Router } from 'express';
import { PERMISSIONS } from '@radeya/shared';

import { can } from '../../middlewares/require-auth';
import { getAuditLog } from './audit.controller';


/**
 * Журнал действий. Только чтение и только для админа: по записям видно,
 * кто чем занимается, и рядовому сотруднику это знать незачем.
 *
 * Эндпоинтов на изменение и удаление нет и не будет — журнал,
 * который можно править, журналом не является.
 */
export const auditRouter = Router();

// Весь модуль — только вошедшим. Маршрут без своего can() не станет публичным.
auditRouter.use(can());

auditRouter.get('/', can(PERMISSIONS.AUDIT_VIEW), getAuditLog);
