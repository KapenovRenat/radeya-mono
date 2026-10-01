import { WORKER_EVENT_TYPES, WORKER_KEYS } from '@radeya/shared';

import type { WorkerSettings } from '../../../../../generated/prisma/client';
import { isTelegramConfigured } from '../../../../../lib/telegram';
import { alertDeveloper } from '../../../engine/worker-alerts';
import { findRecentWorkerEvents, recordWorkerEvent } from '../../../engine/worker-events.service';
import { FAILURE_REPEAT_MS } from '../../../engine/worker.constants';
import { loadCardFonts } from './card-fonts';
import { MAX_SENDS_PER_RUN } from './dispatch.constants';
import { dispatchFollowUps } from './dispatch-followups';
import { dispatchNewOrders, type DispatchBudget } from './dispatch-new';
import { isWithinSendWindow } from './send-window';

/**
 * Шаг 4. Отправка в Telegram — поставщикам и в группу «Из наличия в Астане».
 * Решения — docs/workers.md, раздел 1.
 *
 * Ничего не шлёт, если: отправка выключена; вне окна (дни недели, 8–17 по Астане);
 * нет токена бота или шрифтов карточки. Последние два — настройка сервера:
 * журнал и оповещение разработчику раз в час.
 */
export async function dispatchStep(
  settings: WorkerSettings,
  signal: AbortSignal,
): Promise<Record<string, number>> {
  const cutoff = settings.supplierNotifyFrom;

  if (!settings.supplierNotifyEnabled || cutoff === null) return {};

  const blocked = await findBlocker();

  if (blocked !== null) {
    await reportBlocked(settings, blocked);

    return { dispatchBlocked: 1 };
  }

  if (!isWithinSendWindow(new Date(), settings.supplierNotifyWeekdays)) return { outsideSendWindow: 1 };

  const budget: DispatchBudget = { left: MAX_SENDS_PER_RUN };

  // Отмены первыми: по ним получателю нужно остановить отгрузку.
  const followUps = await dispatchFollowUps(settings, budget, signal);
  const fresh = await dispatchNewOrders(settings, cutoff, budget, signal);

  return {
    dispatchSent: fresh.sent,
    dispatchToDeveloper: fresh.toDeveloper,
    dispatchCancelSent: followUps.cancelSent,
    dispatchReturnSent: followUps.returnSent,
    dispatchSkipped: fresh.skipped,
    dispatchWaitingDate: fresh.waitingDate,
    dispatchNoRecipient: fresh.noRecipient,
    dispatchFailed: fresh.failed + followUps.failed,
  };
}

/** Что мешает слать вообще, независимо от заказа. null — ничего. */
async function findBlocker(): Promise<string | null> {
  if (!isTelegramConfigured()) return 'не задан TELEGRAM_BOT_TOKEN в .env';

  try {
    await loadCardFonts();
  } catch (error) {
    return error instanceof Error ? error.message : 'шрифты карточки не загрузились';
  }

  return null;
}

async function reportBlocked(settings: WorkerSettings, reason: string): Promise<void> {
  const recent = await findRecentWorkerEvents(WORKER_EVENT_TYPES.DISPATCH_BLOCKED, FAILURE_REPEAT_MS);

  if (recent.any) return;

  const message = `Отправка в Telegram невозможна: ${reason}`;

  await recordWorkerEvent(WORKER_KEYS.ORDERS, { type: WORKER_EVENT_TYPES.DISPATCH_BLOCKED, message });
  await alertDeveloper(WORKER_KEYS.ORDERS, settings, message);
}
