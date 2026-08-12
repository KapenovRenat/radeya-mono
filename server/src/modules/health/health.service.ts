import { env } from '../../config/env';
import { isDatabaseReachable } from '../../db/client';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  environment: string;
  /** Сколько секунд прошло с запуска процесса. */
  uptimeSeconds: number;
  database: 'ok' | 'unavailable';
  timestamp: string;
}

/**
 * Сервис знает бизнес-логику и ничего не знает про HTTP.
 * Благодаря этому его можно дёрнуть из воркера или из теста.
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  const databaseReachable = await isDatabaseReachable();

  return {
    // Сервер жив, но без базы работать не может — отдаём degraded.
    status: databaseReachable ? 'ok' : 'degraded',
    environment: env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    database: databaseReachable ? 'ok' : 'unavailable',
    timestamp: new Date().toISOString(),
  };
}
