import type { RequestHandler } from 'express';
import { AUDIT_ACTIONS } from '@radeya/shared';

import { clientIp, logAction } from '../../lib/audit';
import { ValidationError } from '../../lib/errors';
import { saveWarehousesSchema, updateWarehouseSchema, warehouseParamsSchema } from './warehouses.schemas';
import { listWarehouses, saveKaspiWarehouses, updateWarehouseTelegram } from './warehouses.service';

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

/** PATCH /api/warehouses/:id — Telegram-группы склада: Zammler, своя доставка, самовывоз. */
export const patchWarehouse: RequestHandler = async (req, res) => {
  const params = warehouseParamsSchema.safeParse(req.params);

  if (!params.success) throw new ValidationError('Некорректный склад');

  const parsed = updateWarehouseSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Проверьте Telegram ID');
  }

  const { before, after } = await updateWarehouseTelegram(params.data.id, parsed.data);
  const author = req.user!;
  const groups = (dto: typeof before) => ({
    kaspiDeliveryChatId: dto.kaspiDeliveryChatId,
    ownDeliveryChatId: dto.ownDeliveryChatId,
    pickupChatId: dto.pickupChatId,
  });

  await logAction({
    userId: author.id, userLogin: author.login, userRole: author.role,
    action: AUDIT_ACTIONS.WAREHOUSE_UPDATED, entityType: 'Warehouse', entityId: after.id,
    before: groups(before),
    after: groups(after),
    ip: clientIp(req),
  });

  res.json(after);
};
