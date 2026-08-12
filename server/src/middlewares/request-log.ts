import type { RequestHandler } from 'express';

import { logger } from '../lib/logger';

/**
 * Пишет в лог каждый запрос: метод, путь, код ответа, длительность.
 * Тело запроса не логируем — там пароли и персональные данные клиентов.
 */
export const requestLog: RequestHandler = (req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startedAt;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;

    if (res.statusCode >= 500) {
      logger.error(message);
    } else if (res.statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.info(message);
    }
  });

  next();
};
