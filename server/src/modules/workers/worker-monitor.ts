import { WORKER_EVENT_TYPES, WORKER_TITLES, type WorkerKey } from '@radeya/shared';

import { logger } from '../../lib/logger';
import { alertDeveloper } from './worker-alerts';
import { recordWorkerEvent } from './worker-events.service';
import {
  isHeartbeatFresh,
  loadWorkerSettings,
  loadWorkerState,
  updateWorkerState,
} from './worker-settings.service';
import { HEARTBEAT_STALE_MS, MONITOR_INTERVAL_MS } from './worker.constants';

/**
 * Наблюдатель в процессе API: следит за пульсом воркеров.
 *
 * Воркер сам о себе сказать не может, если его процесс мёртв, — поэтому
 * смотрит со стороны API. Включён, а пульса нет — «не отвечает», один раз;
 * пульс вернулся — «снова на связи».
 */
export function startWorkerMonitor(): void {
  const timer = setInterval(() => { void checkWorkers(); }, MONITOR_INTERVAL_MS);

  // Наблюдатель не должен держать процесс API при остановке.
  timer.unref();
}

async function checkWorkers(): Promise<void> {
  for (const key of Object.keys(WORKER_TITLES) as WorkerKey[]) {
    try {
      await checkWorker(key);
    } catch (error) {
      logger.warn(`Наблюдатель воркеров: не удалось проверить ${key}`, error);
    }
  }
}

async function checkWorker(key: WorkerKey): Promise<void> {
  const settings = await loadWorkerSettings(key);
  const state = await loadWorkerState(key);
  const alive = isHeartbeatFresh(state.heartbeatAt);

  if (settings.enabled && !alive && !state.downNotified) {
    const text = `Нет пульса дольше ${HEARTBEAT_STALE_MS / 60_000} мин: процесс воркера не запущен или упал`;

    await updateWorkerState(key, { downNotified: true });
    await recordWorkerEvent(key, { type: WORKER_EVENT_TYPES.WORKER_DOWN, message: text });
    await alertDeveloper(key, settings, text);

    return;
  }

  if (alive && state.downNotified) {
    await updateWorkerState(key, { downNotified: false });
    await recordWorkerEvent(key, { type: WORKER_EVENT_TYPES.WORKER_UP, message: 'Пульс вернулся' });
    await alertDeveloper(key, settings, 'Снова на связи');
  }
}
