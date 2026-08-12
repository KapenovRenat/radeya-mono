import { env } from '../config/env';

/**
 * Минимальный логгер без внешних зависимостей.
 * Когда понадобится запись в файл или отправка в внешний сервис —
 * меняется только этот файл, вызовы по коду остаются прежними.
 */

const LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type Level = (typeof LEVELS)[number];

const currentLevelIndex = LEVELS.indexOf(env.LOG_LEVEL);

function write(level: Level, message: string, meta?: unknown): void {
  if (LEVELS.indexOf(level) < currentLevelIndex) return;

  const time = new Date().toISOString();
  const line = `[${time}] ${level.toUpperCase()} ${message}`;

  if (meta !== undefined) {
    console[level === 'debug' ? 'log' : level](line, meta);
    return;
  }

  console[level === 'debug' ? 'log' : level](line);
}

export const logger = {
  debug: (message: string, meta?: unknown) => write('debug', message, meta),
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
};
