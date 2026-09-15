import type { RequestHandler } from 'express';
import { AUDIT_ACTIONS } from '@radeya/shared';

import { clientIp, logAction } from '../../lib/audit';
import { ValidationError } from '../../lib/errors';
import { saveWarehousesSchema } from './warehouses.schemas';
import { listWarehouses, saveKaspiWarehouses } from './warehouses.service';

/** GET /api/warehouses */
export const getWarehouses: RequestHandler = async (_req, res) => {
  res.json({ items: await listWarehouses() });
};

/** POST /api/warehouses/import-kaspi */
export const postKaspiWarehouses: RequestHandler = async (req, res) => {
  const parsed = saveWarehousesSchema.safeParse(req.body);

  if (!parsed.success) {
    const details: Record<string, string[]> = {};

    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.') || 'form';
      details[field] = [...(details[field] ?? []), issue.message];
    }

    throw new ValidationError('Склады из выгрузки не прошли проверку', details);
  }

  const result = await saveKaspiWarehouses(parsed.data);

  const author = req.user!;

  await logAction({
    userId: author.id,
    userLogin: author.login,
    userRole: author.role,
    action: AUDIT_ACTIONS.KASPI_WAREHOUSES_SAVED,
    entityType: 'Warehouse',
    after: result,
    ip: clientIp(req),
  });

  res.json(result);
};
