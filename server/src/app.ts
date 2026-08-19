import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';

import { corsOrigins } from './config/env';
import { apiRouter } from './routes';
import { errorHandler } from './middlewares/error-handler';
import { notFound } from './middlewares/not-found';
import { requestLog } from './middlewares/request-log';

/**
 * Сборка Express-приложения отдельно от запуска сервера.
 * Так приложение можно поднять в тестах, не занимая порт.
 *
 * Порядок мидлваров важен: сначала защита и разбор тела,
 * потом маршруты, и только в конце — 404 и обработчик ошибок.
 */
export function createApp() {
  const app = express();

  // Заголовки безопасности (CSP, X-Frame-Options и прочие).
  app.use(helmet());

  // Доступ только с известных адресов. credentials — чтобы работала кука сессии.
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );

  // Лимит защищает от простейшего перегруза большим телом запроса.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Разбор кук: в них лежит идентификатор сессии.
  app.use(cookieParser());

  app.use(requestLog);

  app.use('/api', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
