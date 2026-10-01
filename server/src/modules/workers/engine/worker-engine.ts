import { WORKER_EVENT_TYPES, WORKER_STATUSES, type WorkerKey } from '@radeya/shared';

import { disconnectDatabase } from '../../../db/client';
import type { WorkerSettings } from '../../../generated/prisma/client';
import { withAdvisoryLock } from '../../../lib/advisory-lock';
import { logger } from '../../../lib/logger';
import { alertDeveloper } from './worker-alerts';
import { recordWorkerEvent } from './worker-events.service';
import { loadWorkerSettings, loadWorkerState, updateWorkerState } from './worker-settings.service';
import {
  ALERT_AFTER_FAILURES,
  HEARTBEAT_MS,
  LOCK_HOLD_MARGIN_MS,
  LOOP_ERROR_PAUSE_MS,
  SETTINGS_POLL_MS,
  WORKER_RUN_TIMEOUT_MS,
} from './worker.constants';

/**
 * Движок воркеров — общий для всех. Что делает конкретный воркер — его
 * `WorkerJob` в `jobs/<имя>/`. Устройство — docs/workers.md.
 *
 *   читаем настройки → выключен: ждём → включён: цикл → ждём интервал → снова
 *
 * Каждый воркер крутит свой цикл со своими настройками, состоянием и пульсом:
 * снятая галочка или ошибка одного не задевает другие. Следующий цикл
 * планируется после конца текущего — наложений нет.
 */

export interface JobContext {
  settings: WorkerSettings;
  /** Срабатывает, когда цикл превысил потолок. Работа проверяет его между запросами. */
  signal: AbortSignal;
}

export interface WorkerJob {
  key: WorkerKey;
  /** Блокировка PostgreSQL: её же берут ручные операции с теми же данными. */
  lockKey: number;
  /** Один цикл. Возвращает счётчики для блока состояния. */
  run(context: JobContext): Promise<Record<string, number>>;
}

class RunTimeoutError extends Error {
  constructor() {
    super(`Цикл не уложился в ${WORKER_RUN_TIMEOUT_MS / 60_000} мин и прерван`);
  }
}

/**
 * Запуск воркеров в этом процессе. Не возвращается: циклы бесконечные.
 * Пульс и штатная остановка — одни на процесс для всех воркеров: два
 * обработчика остановки завершили бы процесс, не дав второму стереть пульс.
 */
export async function startWorkers(jobs: WorkerJob[]): Promise<void> {
  for (const job of jobs) await announceProcessStart(job);

  const keys = jobs.map((job) => job.key);
  const heartbeat = setInterval(() => {
    for (const key of keys) void beat(key);
  }, HEARTBEAT_MS);

  await Promise.all(keys.map(beat));

  registerShutdown(keys, heartbeat);

  await Promise.all(jobs.map(loop));
}

/**
 * Пульс жив при старте — значит, прошлый процесс не дошёл до штатной
 * остановки (она пульс стирает). Это сбой: пишем и оповещаем.
 */
async function announceProcessStart(job: WorkerJob): Promise<void> {
  const state = await loadWorkerState(job.key);
  const settings = await loadWorkerSettings(job.key);
  const crashed = state.heartbeatAt !== null;

  await recordWorkerEvent(job.key, crashed
    ? {
      type: WORKER_EVENT_TYPES.WORKER_RESTARTED,
      message: 'Процесс перезапущен после сбоя: прошлый не остановился штатно',
    }
    : { type: WORKER_EVENT_TYPES.WORKER_PROCESS_STARTED, message: 'Процесс воркера запущен' });

  if (crashed) await alertDeveloper(job.key, settings, 'Перезапуск после сбоя процесса');

  // Цикл, оборванный падением, так и висел бы «идёт» в настройках.
  if (state.status === WORKER_STATUSES.RUNNING) {
    await updateWorkerState(job.key, {
      status: settings.enabled ? WORKER_STATUSES.IDLE : WORKER_STATUSES.STOPPED,
      runStartedAt: null,
    });
  }
}

async function loop(job: WorkerJob): Promise<never> {
  // null — ещё не знаем: первый проход не считается «запустили» или «остановили».
  let enabledBefore: boolean | null = null;

  for (;;) {
    try {
      const settings = await loadWorkerSettings(job.key);

      if (!settings.enabled) {
        if (enabledBefore !== false) {
          await updateWorkerState(job.key, { status: WORKER_STATUSES.STOPPED, nextRunAt: null });
        }

        if (enabledBefore === true) {
          await recordWorkerEvent(job.key, {
            type: WORKER_EVENT_TYPES.WORKER_STOPPED, message: 'Остановлен в настройках',
          });
          await alertDeveloper(job.key, settings, 'Остановлен в настройках');
        }

        enabledBefore = false;
        await sleep(SETTINGS_POLL_MS);
        continue;
      }

      if (enabledBefore === false) {
        await recordWorkerEvent(job.key, {
          type: WORKER_EVENT_TYPES.WORKER_STARTED, message: 'Запущен в настройках',
        });
        await alertDeveloper(job.key, settings, 'Запущен в настройках');
      }

      enabledBefore = true;

      await runCycle(job, settings);
      await waitForNextCycle(job.key, settings);
    } catch (error) {
      // Сюда попадает только сбой самого движка (например, база недоступна) —
      // ошибки работы ловит runCycle. Ждём и пробуем снова: воркер не умирает.
      logger.error(`Воркер ${job.key}: сбой цикла движка`, error);
      await sleep(LOOP_ERROR_PAUSE_MS);
    }
  }
}

async function runCycle(job: WorkerJob, settings: WorkerSettings): Promise<void> {
  const before = await loadWorkerState(job.key);
  const startedAt = Date.now();

  await updateWorkerState(job.key, {
    status: WORKER_STATUSES.RUNNING, runStartedAt: new Date(startedAt), nextRunAt: null,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new RunTimeoutError()), WORKER_RUN_TIMEOUT_MS);

  try {
    const outcome = await withAdvisoryLock(
      job.lockKey,
      () => raceWithAbort(job.run({ settings, signal: controller.signal }), controller.signal),
      WORKER_RUN_TIMEOUT_MS + LOCK_HOLD_MARGIN_MS,
    );
    const finished = { runStartedAt: null, lastRunFinishedAt: new Date(), lastRunTookMs: Date.now() - startedAt };

    if (!outcome.acquired) {
      await updateWorkerState(job.key, { status: WORKER_STATUSES.IDLE, ...finished });
      await recordWorkerEvent(job.key, {
        type: WORKER_EVENT_TYPES.RUN_SKIPPED_LOCKED,
        message: 'Цикл пропущен: эти данные сейчас обрабатываются вручную',
      });

      return;
    }

    await updateWorkerState(job.key, {
      status: WORKER_STATUSES.IDLE,
      ...finished,
      lastSuccessAt: new Date(),
      lastError: null,
      consecutiveFailures: 0,
      lastRunStats: outcome.value,
    });

    if (before.consecutiveFailures >= ALERT_AFTER_FAILURES) {
      const text = `Восстановился после ${before.consecutiveFailures} ошибок подряд`;

      await recordWorkerEvent(job.key, { type: WORKER_EVENT_TYPES.WORKER_RECOVERED, message: text });
      await alertDeveloper(job.key, settings, text);
    }
  } catch (error) {
    const timedOut = controller.signal.aborted;
    const message = timedOut
      ? new RunTimeoutError().message
      : error instanceof Error ? error.message : 'неизвестная ошибка';
    const failures = before.consecutiveFailures + 1;

    logger.error(`Воркер ${job.key}: цикл с ошибкой (${failures} подряд)`, error);

    await updateWorkerState(job.key, {
      status: WORKER_STATUSES.ERROR,
      runStartedAt: null,
      lastRunFinishedAt: new Date(),
      lastRunTookMs: Date.now() - startedAt,
      lastError: message,
      consecutiveFailures: failures,
    });
    await recordWorkerEvent(job.key, {
      type: timedOut ? WORKER_EVENT_TYPES.RUN_TIMEOUT : WORKER_EVENT_TYPES.RUN_FAILED,
      message,
      details: { consecutiveFailures: failures },
    });

    // Ровно на пороге, а не на каждой ошибке после него — одно оповещение на серию.
    if (failures === ALERT_AFTER_FAILURES) {
      const text = `${failures} цикла подряд с ошибкой. Последняя: ${message}`;

      await recordWorkerEvent(job.key, { type: WORKER_EVENT_TYPES.WORKER_FAILING, message: text });
      await alertDeveloper(job.key, settings, text);
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ждём интервал от конца цикла. Сохранили настройки — выходим сразу:
 * новый интервал или остановка применяются без ожидания старого срока.
 */
async function waitForNextCycle(key: WorkerKey, settings: WorkerSettings): Promise<void> {
  const nextAt = Date.now() + settings.intervalMinutes * 60_000;

  await updateWorkerState(key, { nextRunAt: new Date(nextAt) });

  while (Date.now() < nextAt) {
    await sleep(Math.min(SETTINGS_POLL_MS, nextAt - Date.now()));

    const fresh = await loadWorkerSettings(key);

    if (fresh.updatedAt.getTime() !== settings.updatedAt.getTime()) return;
  }
}

/**
 * Работа против потолка времени. Работа сама проверяет сигнал между
 * запросами, но запрос может и зависнуть — тогда цикл всё равно отпускается
 * по сигналу, а запрос дотаймаутится сам (у каждого свой таймаут).
 */
function raceWithAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  // Проигравшая гонку работа может упасть позже — без catch это был бы
  // необработанный отказ и падение процесса.
  work.catch(() => undefined);

  return Promise.race([
    work,
    new Promise<never>((_, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }),
  ]);
}

async function beat(key: WorkerKey): Promise<void> {
  try {
    await updateWorkerState(key, { heartbeatAt: new Date() });
  } catch (error) {
    logger.warn(`Воркер ${key}: пульс не записан`, error);
  }
}

/**
 * Штатная остановка стирает пульс всем воркерам процесса: следующий старт
 * поймёт, что сбоя не было. Не успели за 10 секунд — выходим как есть,
 * следующий старт сочтёт это сбоем.
 */
function registerShutdown(keys: WorkerKey[], heartbeat: NodeJS.Timeout): void {
  let stopping = false;

  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;

    logger.info(`Воркеры: получен ${signal}, останавливаюсь`);
    clearInterval(heartbeat);

    setTimeout(() => process.exit(1), 10_000).unref();

    try {
      for (const key of keys) {
        const state = await loadWorkerState(key);

        await updateWorkerState(key, {
          heartbeatAt: null,
          runStartedAt: null,
          ...(state.status === WORKER_STATUSES.RUNNING ? { status: WORKER_STATUSES.IDLE } : {}),
        });
      }

      await disconnectDatabase();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => { void shutdown('SIGINT'); });
  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
