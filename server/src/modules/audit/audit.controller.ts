import type { RequestHandler } from 'express';

import { listAuditLog } from './audit.service';

/** GET /api/audit?page=1 */
export const getAuditLog: RequestHandler = async (req, res) => {
  const page = Number(req.query.page ?? 1);

  res.json(await listAuditLog(page));
};
