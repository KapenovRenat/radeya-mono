import type { RequestHandler } from 'express';

import { NotFoundError } from '../lib/errors';

/**
 * Ловит запросы, не подошедшие ни одному маршруту.
 * Ставится после всех роутов, но до errorHandler.
 */
export const notFound: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Маршрут ${req.method} ${req.originalUrl} не существует`));
};
