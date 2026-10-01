import { prisma } from '../db/client';

/**
 * Блокировки PostgreSQL (advisory lock) между процессами.
 *
 * Нужны там, где одну работу могут начать двое: воркер и кнопка на странице,
 * или два процесса сервера. Блокировка живёт в транзакции: упал процесс —
 * соединение закрылось, и PostgreSQL снимает её сам. Зависшей блокировки
 * после сбоя не бывает.
 */

/** Номера блокировок. Любые уникальные числа; держим списком, чтобы не совпали. */
export const LOCKS = {
  /** Синхронизация заказов Kaspi: воркер и кнопки на странице заказов. */
  KASPI_ORDERS_SYNC: 72_010_001,
} as const;

export type LockResult<T> = { acquired: true; value: T } | { acquired: false };

/**
 * Выполнить `run`, если блокировка свободна. Занята — сразу `acquired: false`,
 * без ожидания: второй участник пропускает ход, а не встаёт в очередь.
 *
 * `holdMs` — сколько максимум держать блокировку. Должно быть больше самой
 * долгой работы: по истечении PostgreSQL-транзакция закрывается.
 */
export async function withAdvisoryLock<T>(
  lockKey: number,
  run: () => Promise<T>,
  holdMs: number,
): Promise<LockResult<T>> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_xact_lock(${lockKey}::bigint) AS locked`;

    if (rows[0]?.locked !== true) return { acquired: false } as const;

    // Работа идёт через общий клиент, не через tx: транзакция здесь только
    // держит блокировку, а записи внутри неё растянули бы её на весь цикл.
    return { acquired: true, value: await run() } as const;
  }, { timeout: holdMs, maxWait: 10_000 });
}
