import { z } from 'zod';
import { DICTIONARY_KINDS, DICTIONARY_NAME_MAX_LENGTH } from '@radeya/shared';

const kindSchema = z.enum([
  DICTIONARY_KINDS.CUSTOMER_SOURCE,
  DICTIONARY_KINDS.DELIVERY_STATUS,
  DICTIONARY_KINDS.SHIPMENT_ORIGIN,
  DICTIONARY_KINDS.PAYMENT_METHOD,
]);

/**
 * Вид списка приходит из закрытого перечисления, а не строкой: иначе первый же
 * запрос с опечаткой завёл бы четвёртый с половиной справочник, о котором
 * не знает ни один экран.
 */
export const dictionaryListSchema = z.object({
  kind: kindSchema.optional(),
}).strict();

export const createDictionaryItemSchema = z.object({
  kind: kindSchema,
  name: z.string().trim().min(1).max(DICTIONARY_NAME_MAX_LENGTH),
}).strict();

/** Вид не меняется: это был бы перенос значения в другой список вместе с заказами. */
export const updateDictionaryItemSchema = z.object({
  name: z.string().trim().min(1).max(DICTIONARY_NAME_MAX_LENGTH).optional(),
  isActive: z.boolean().optional(),
}).strict()
  .refine((body) => body.name !== undefined || body.isActive !== undefined,
    'Не указано, что менять');

export const dictionaryParamsSchema = z.object({ id: z.string().uuid() });

export type DictionaryListInput = z.infer<typeof dictionaryListSchema>;
export type CreateDictionaryItemInput = z.infer<typeof createDictionaryItemSchema>;
export type UpdateDictionaryItemInput = z.infer<typeof updateDictionaryItemSchema>;
