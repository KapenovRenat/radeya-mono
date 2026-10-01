import { z } from 'zod';
import {
  SUPPLIER_ADDRESS_MAX_LENGTH,
  SUPPLIER_IMPORT_MAX_ROWS,
  SUPPLIER_NAME_MAX_LENGTH,
  SUPPLIER_PHONE_MAX_LENGTH,
  SUPPLIER_TELEGRAM_ID_MAX_LENGTH,
  TELEGRAM_CHAT_ID_PATTERN,
} from '@radeya/shared';

/**
 * Валидация входа модуля поставщиков.
 *
 * Строки предпросмотра приходят обратно от клиента, и доверять им нельзя:
 * между показом и записью их можно подменить целиком. Поэтому схема строки
 * повторяет контракт полностью, а не принимает «что прислали».
 */

/** Без листа отдаётся только оглавление книги. */
export const previewSuppliersSchema = z.object({
  sheet: z.string().trim().min(1).optional(),
}).strict();

const nullableText = (max: number) => z.string().trim().min(1).max(max).nullable();

/**
 * Разобранная строка.
 *
 * `known` и `diffs` клиент присылает обратно, но сервер их не использует:
 * он сам заново читает базу перед записью. Принимаются они только чтобы
 * не заставлять клиента вырезать поля из того, что ему отдали.
 */
const supplierDraftSchema = z.object({
  row: z.number().int().nonnegative(),
  externalId: z.string().trim().min(1).max(64).nullable(),
  name: nullableText(SUPPLIER_NAME_MAX_LENGTH),
  address: nullableText(SUPPLIER_ADDRESS_MAX_LENGTH),
  phone: nullableText(SUPPLIER_PHONE_MAX_LENGTH),
  known: z.boolean(),
  diffs: z.array(z.object({
    field: z.enum(['name', 'address', 'phone']),
    ours: z.string().nullable(),
    file: z.string().nullable(),
  })),
  problems: z.array(z.object({
    column: z.string().nullable(),
    message: z.string(),
  })),
}).strict();

export const commitSuppliersSchema = z.object({
  sheet: z.string().trim().min(1),
  rows: z.array(supplierDraftSchema).min(1).max(SUPPLIER_IMPORT_MAX_ROWS),
}).strict();

/**
 * Правка карточки руками.
 *
 * `externalId` сменить нельзя: это ключ сверки с МойСкладом, и подмена
 * склеила бы двух поставщиков при следующем импорте.
 */
export const updateSupplierSchema = z.object({
  name: z.string().trim().min(1).max(SUPPLIER_NAME_MAX_LENGTH).optional(),
  address: nullableText(SUPPLIER_ADDRESS_MAX_LENGTH).optional(),
  phone: nullableText(SUPPLIER_PHONE_MAX_LENGTH).optional(),
  // Числом, как его выдаёт Telegram: личка — положительное, группа — с минусом.
  // Ник вида @name бот не примет как адрес — лучше отказать сразу, чем молча не отправить.
  telegramId: z.string().trim().max(SUPPLIER_TELEGRAM_ID_MAX_LENGTH)
    .regex(TELEGRAM_CHAT_ID_PATTERN, 'Telegram ID — только цифры, у группы с минусом')
    .nullable().optional(),
  isActive: z.boolean().optional(),
}).strict()
  .refine((body) => Object.keys(body).length > 0, 'Не указано, что менять');

export const supplierParamsSchema = z.object({ id: z.string().uuid() });

export type PreviewSuppliersInput = z.infer<typeof previewSuppliersSchema>;
export type CommitSuppliersInput = z.infer<typeof commitSuppliersSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
