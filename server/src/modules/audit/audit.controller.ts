import type { RequestHandler } from 'express';

import { ValidationError } from '../../lib/errors';
import { auditQuerySchema } from './audit.schemas';
import { listAuditLog } from './audit.service';

/** GET /api/audit?page=1&entityType=Variant&entityId=…&action=… */
export const getAuditLog: RequestHandler = async (req, res) => {
  const parsed = auditQuerySchema.safeParse(req.query);

  if (!parsed.success) throw new ValidationError('Проверьте страницу и фильтры журнала');

  res.json(await listAuditLog(parsed.data));
};
