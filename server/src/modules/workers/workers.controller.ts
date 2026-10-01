import type { RequestHandler } from 'express';
import { AUDIT_ACTIONS, type SendTestCardResponse, type WorkersResponse } from '@radeya/shared';

import { clientIp, logAction } from '../../lib/audit';
import { ValidationError } from '../../lib/errors';
import { listWorkers, updateWorkerSettings } from './engine/worker-settings.service';
import { sendTestCard } from './jobs/orders/dispatch/test-card';
import { sendTestCardSchema, updateWorkerSettingsSchema, workerParamsSchema } from './workers.schemas';

/** GET /api/workers — настройки и состояние всех воркеров. */
export const getWorkers: RequestHandler = async (_req, res) => {
  const body: WorkersResponse = { items: await listWorkers() };

  res.json(body);
};

/**
 * POST /api/workers/orders/test-card — тестовая карточка на указанный ID или всем
 * с Telegram ID. Итог по каждому получателю: ответ Telegram «chat not found» и есть диагноз.
 */
export const postTestCard: RequestHandler = async (req, res) => {
  const parsed = sendTestCardSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Проверьте Telegram ID');
  }

  const body: SendTestCardResponse = await sendTestCard(parsed.data);

  res.json(body);
};

/** PUT /api/workers/:key/settings — сохранить настройки; воркер подхватит сам. */
export const putWorkerSettings: RequestHandler = async (req, res) => {
  const params = workerParamsSchema.safeParse(req.params);

  if (!params.success) throw new ValidationError('Неизвестный воркер');

  const parsed = updateWorkerSettingsSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Проверьте настройки воркера');
  }

  const author = req.user!;
  const { before, after, worker } = await updateWorkerSettings(params.data.key, parsed.data, author.login);

  await logAction({
    userId: author.id, userLogin: author.login, userRole: author.role,
    action: AUDIT_ACTIONS.WORKER_SETTINGS_UPDATED, entityType: 'WorkerSettings',
    entityId: params.data.key, before, after,
    ip: clientIp(req),
  });

  res.json(worker);
};
