import type { RequestHandler } from 'express';
import { AUDIT_ACTIONS, type AuditAction } from '@radeya/shared';

import { clientIp, logAction } from '../../lib/audit';
import { ValidationError } from '../../lib/errors';
import { createSalesPointSchema, salesPointParamsSchema,
  updateSalesPointSchema } from './sales-points.schemas';
import { createOfflineSalesPoint, listSalesPoints, updateSalesPoint } from './sales-points.service';

/** Справочник точек продаж: фильтр реестра заказов и разрез статистики. */
export const getSalesPoints: RequestHandler = async (_req, res) => {
  res.json(await listSalesPoints());
};

export const postSalesPoint: RequestHandler = async (req, res) => {
  const parsed = createSalesPointSchema.safeParse(req.body);

  if (!parsed.success) throw new ValidationError('Проверьте название точки продаж');

  const point = await createOfflineSalesPoint(parsed.data);
  const author = req.user!;

  await logAction({
    userId: author.id, userLogin: author.login, userRole: author.role,
    action: AUDIT_ACTIONS.SALES_POINT_CREATED, entityType: 'SalesPoint', entityId: point.id,
    after: point, ip: clientIp(req),
  });

  res.status(201).json(point);
};

/**
 * Переименование и закрытие одним методом.
 *
 * В журнал идут разные действия: «переименована» и «закрыта» — разные новости,
 * и искать их в журнале будут по отдельности. Если изменилось и то и другое,
 * пишем обе записи.
 */
export const patchSalesPoint: RequestHandler = async (req, res) => {
  const params = salesPointParamsSchema.safeParse(req.params);
  const body = updateSalesPointSchema.safeParse(req.body);

  if (!params.success || !body.success) {
    throw new ValidationError('Проверьте точку продаж и переданные поля');
  }

  const { before, after } = await updateSalesPoint(params.data.id, body.data);
  const author = req.user!;
  const actions: AuditAction[] = [];

  if (before.name !== after.name) actions.push(AUDIT_ACTIONS.SALES_POINT_RENAMED);
  if (before.isActive !== after.isActive) {
    actions.push(after.isActive ? AUDIT_ACTIONS.SALES_POINT_REOPENED : AUDIT_ACTIONS.SALES_POINT_CLOSED);
  }

  for (const action of actions) {
    await logAction({
      userId: author.id, userLogin: author.login, userRole: author.role,
      action, entityType: 'SalesPoint', entityId: after.id,
      before, after, ip: clientIp(req),
    });
  }

  res.json(after);
};
