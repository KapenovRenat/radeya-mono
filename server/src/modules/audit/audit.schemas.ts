import { z } from 'zod';
import { AUDIT_ACTIONS } from '@radeya/shared';

/** Сущность в журнале — имя модели: `Variant`, `SalesPoint`. Не свободный текст. */
const ENTITY_TYPE_PATTERN = /^[A-Z][A-Za-z]{1,49}$/;

/**
 * Фильтры журнала. Сущность передаётся парой: тип без id вытащил бы
 * историю всех товаров разом, id без типа — ничего не значит.
 */
export const auditQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  entityType: z.string().regex(ENTITY_TYPE_PATTERN).optional(),
  entityId: z.string().uuid().optional(),
  action: z.enum(Object.values(AUDIT_ACTIONS) as [string, ...string[]]).optional(),
}).strict().refine(
  (query) => (query.entityType === undefined) === (query.entityId === undefined),
  { message: 'entityType и entityId передаются вместе' },
);

export type AuditQueryInput = z.infer<typeof auditQuerySchema>;
