import {
  LOGIN_MAX_LENGTH,
  LOGIN_MIN_LENGTH,
  LOGIN_PATTERN,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
  USER_ROLES,
  normalizeLogin,
} from '@radeya/shared';
import { z } from 'zod';

/**
 * Создание сотрудника. Правила логина и пароля берутся из shared —
 * там единственный источник, здесь только применение.
 *
 * В отличие от входа, здесь детали ошибок отдаём: админ должен понимать,
 * что именно не так с логином. Подсказки для перебора тут нет — эндпоинт
 * доступен только вошедшему администратору.
 */
export const createUserSchema = z.object({
  login: z
    .string()
    .transform(normalizeLogin)
    .pipe(
      z
        .string()
        .min(LOGIN_MIN_LENGTH, `Не короче ${LOGIN_MIN_LENGTH} символов`)
        .max(LOGIN_MAX_LENGTH, `Не длиннее ${LOGIN_MAX_LENGTH} символов`)
        .regex(LOGIN_PATTERN, 'Только латиница, цифры, точка, дефис и подчёркивание'),
    ),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Не короче ${PASSWORD_MIN_LENGTH} символов`)
    .max(PASSWORD_MAX_LENGTH, `Не длиннее ${PASSWORD_MAX_LENGTH} символов`)
    .regex(PASSWORD_PATTERN, 'Только латиница, цифры и знаки препинания'),
  name: z.string().trim().min(1, 'Имя обязательно').max(120),
  position: z.string().trim().min(1, 'Должность обязательна').max(120),
  role: z.enum([USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SELLER]),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
