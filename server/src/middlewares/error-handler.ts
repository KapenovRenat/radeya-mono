import type { ErrorRequestHandler } from 'express';
import type { ApiErrorResponse } from '@radeya/shared';

import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { isProduction } from '../config/env';

/**
 * Единый обработчик ошибок. Ставится ПОСЛЕДНИМ в цепочке мидлваров.
 *
 * Наружу уходит только форма ApiErrorResponse. Стек и внутренние детали
 * в ответ не попадают никогда: по ним видно структуру проекта и версии библиотек.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    const body: ApiErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    };

    res.status(err.statusCode).json(body);
    return;
  }

  // Всё, что не AppError, — наш недосмотр. Логируем целиком, наружу отдаём общее.
  logger.error(`Необработанная ошибка: ${req.method} ${req.originalUrl}`, err);

  const body: ApiErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction
        ? 'Внутренняя ошибка сервера'
        : err instanceof Error
          ? err.message
          : 'Внутренняя ошибка сервера',
    },
  };

  res.status(500).json(body);
};
