import {
  LOGIN_MAX_LENGTH,
  LOGIN_MIN_LENGTH,
  LOGIN_PATTERN,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
  normalizeLogin,
} from '@radeya/shared';
import { z } from 'zod';

/**
 * Валидация входа. Правила берутся из shared, чтобы форма и сервер
 * не разошлись: там один источник, здесь только его применение.
 */
export const loginSchema = z.object({
  login: z
    .string()
    .transform(normalizeLogin)
    .pipe(
      z
        .string()
        .min(LOGIN_MIN_LENGTH)
        .max(LOGIN_MAX_LENGTH)
        .regex(LOGIN_PATTERN),
    ),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH)
    .max(PASSWORD_MAX_LENGTH)
    .regex(PASSWORD_PATTERN),
});

export type LoginInput = z.infer<typeof loginSchema>;
