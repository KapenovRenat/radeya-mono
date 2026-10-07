import {
  LOGIN_MAX_LENGTH,
  LOGIN_MIN_LENGTH,
  LOGIN_PATTERN,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
  PERMISSIONS,
  USER_ROLES,
  normalizeLogin,
  normalizePermissions,
} from '@radeya/shared';
import { z } from 'zod';

/** Права — только из списка PERMISSIONS: незнакомый ключ — ошибка, а не тихий пропуск. */
const permissionsSchema = z.array(z.enum(PERMISSIONS)).max(Object.keys(PERMISSIONS).length * 2)
  .transform(normalizePermissions);

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Не короче ${PASSWORD_MIN_LENGTH} символов`)
  .max(PASSWORD_MAX_LENGTH, `Не длиннее ${PASSWORD_MAX_LENGTH} символов`)
  .regex(PASSWORD_PATTERN, 'Только латиница, цифры и знаки препинания');

const nameSchema = z.string().trim().min(1, 'Имя обязательно').max(120);
const positionSchema = z.string().trim().min(1, 'Должность обязательна').max(120);

/**
 * Создание сотрудника. Правила логина и пароля берутся из shared —
 * там единственный источник, здесь только применение.
 *
 * В отличие от входа, здесь детали ошибок отдаём: админ должен понимать,
 * что именно не так с логином. Подсказки для перебора тут нет — эндпоинт
 * доступен только с правом USERS_MANAGE.
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
  password: passwordSchema,
  name: nameSchema,
  position: positionSchema,
  // Весь список из shared: новая роль в USER_ROLES принимается без правки здесь.
  role: z.enum(USER_ROLES),
  permissions: permissionsSchema,
}).strict();

/** Правка карточки: логин не меняется; пароль — только если передан. */
export const updateUserSchema = z.object({
  name: nameSchema,
  position: positionSchema,
  role: z.enum(USER_ROLES),
  permissions: permissionsSchema,
  password: passwordSchema.optional(),
}).strict();

export const userParamsSchema = z.object({ id: z.string().uuid() });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
