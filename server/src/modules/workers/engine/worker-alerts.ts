import { WORKER_TITLES, type WorkerKey } from '@radeya/shared';

import { env } from '../../../config/env';
import type { WorkerSettings } from '../../../generated/prisma/client';
import { logger } from '../../../lib/logger';
import { escapeTelegramHtml, isTelegramConfigured, sendTelegramMessage } from '../../../lib/telegram';

/**
 * Оповещение разработчика о состоянии воркера: упал, восстановился, перезапущен.
 *
 * Только при смене состояния, а не на каждом цикле: иначе при недоступном
 * Kaspi сообщение приходило бы раз в две минуты, и его перестали бы читать.
 * Сбой отправки не мешает работе — уходит в лог.
 */
export async function alertDeveloper(
  key: WorkerKey,
  settings: WorkerSettings,
  text: string,
): Promise<void> {
  if (!settings.devAlertsEnabled || !settings.devChatId || !isTelegramConfigured()) return;

  const title = `⚙️ <b>${escapeTelegramHtml(WORKER_TITLES[key])}</b> · ${env.NODE_ENV}`;

  try {
    await sendTelegramMessage(settings.devChatId, `${title}\n${escapeTelegramHtml(text)}`);
  } catch (error) {
    logger.warn(`Воркер ${key}: оповещение разработчику не ушло`, error);
  }
}
