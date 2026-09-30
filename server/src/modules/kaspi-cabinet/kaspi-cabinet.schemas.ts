import { z } from 'zod';
import {
  KASPI_CABINET_EMAIL_MAX_LENGTH,
  KASPI_CABINET_PASSWORD_MAX_LENGTH,
} from '@radeya/shared';

/**
 * Данные для входа в кабинет Kaspi.
 *
 * Пароль не обрезается: пробел по краям может быть его частью, и молча
 * отрезанный он превратился бы в «Kaspi не принял пароль» без видимой причины.
 */
export const saveCabinetAccountSchema = z.object({
  email: z.string().trim().max(KASPI_CABINET_EMAIL_MAX_LENGTH).pipe(z.email()),
  password: z.string().min(1).max(KASPI_CABINET_PASSWORD_MAX_LENGTH),
}).strict();

export type SaveCabinetAccountInput = z.infer<typeof saveCabinetAccountSchema>;
