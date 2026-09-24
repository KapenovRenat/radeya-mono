import type { RequestHandler } from 'express';

import { ValidationError } from '../../lib/errors';
import { orderStatsSchema } from './stats.schemas';
import { getOrderStats } from './stats.service';

/** Сводка по заказам за период, в разрезе точек продаж. */
export const getOrdersStats: RequestHandler = async (req, res) => {
  const parsed = orderStatsSchema.safeParse(req.query);

  if (!parsed.success) throw new ValidationError('Проверьте границы периода');

  res.json(await getOrderStats(parsed.data));
};
