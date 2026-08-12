import type { RequestHandler } from 'express';

import { getHealthStatus } from './health.service';

/**
 * Контроллер знает только про req/res. Вся логика — в сервисе.
 * Express 5 сам ловит ошибки из async-обработчиков и отдаёт их в errorHandler.
 */
export const healthCheck: RequestHandler = async (_req, res) => {
  const status = await getHealthStatus();

  // 503, если база не отвечает: мониторинг должен видеть это по коду ответа.
  res.status(status.status === 'ok' ? 200 : 503).json(status);
};
