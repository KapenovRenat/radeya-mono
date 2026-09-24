import type { RequestHandler } from 'express';
import { AUDIT_ACTIONS, type AuditAction } from '@radeya/shared';

import { clientIp, logAction } from '../../lib/audit';
import { ValidationError } from '../../lib/errors';
import { createDictionaryItemSchema, dictionaryListSchema, dictionaryParamsSchema,
  updateDictionaryItemSchema } from './dictionaries.schemas';
import { createDictionaryItem, listDictionaries, updateDictionaryItem } from './dictionaries.service';

/** Значения списков: все четыре разом либо один по `?kind=`. */
export const getDictionaries: RequestHandler = async (req, res) => {
  const parsed = dictionaryListSchema.safeParse(req.query);

  if (!parsed.success) throw new ValidationError('Неизвестный вид справочника');

  res.json(await listDictionaries(parsed.data));
};

export const postDictionaryItem: RequestHandler = async (req, res) => {
  const parsed = createDictionaryItemSchema.safeParse(req.body);

  if (!parsed.success) throw new ValidationError('Проверьте вид справочника и название');

  const item = await createDictionaryItem(parsed.data);
  const author = req.user!;

  await logAction({
    userId: author.id, userLogin: author.login, userRole: author.role,
    action: AUDIT_ACTIONS.DICTIONARY_ITEM_CREATED, entityType: 'DictionaryItem',
    entityId: item.id, after: item, ip: clientIp(req),
  });

  res.status(201).json(item);
};

/**
 * Переименование и закрытие одним методом.
 *
 * В журнал идут разные действия: переименование и закрытие — разные новости,
 * и искать их будут по отдельности. Изменилось и то и другое — пишем обе записи.
 */
export const patchDictionaryItem: RequestHandler = async (req, res) => {
  const params = dictionaryParamsSchema.safeParse(req.params);
  const body = updateDictionaryItemSchema.safeParse(req.body);

  if (!params.success || !body.success) {
    throw new ValidationError('Проверьте значение справочника и переданные поля');
  }

  const { before, after } = await updateDictionaryItem(params.data.id, body.data);
  const author = req.user!;
  const actions: AuditAction[] = [];

  if (before.name !== after.name) actions.push(AUDIT_ACTIONS.DICTIONARY_ITEM_RENAMED);
  if (before.isActive !== after.isActive) {
    actions.push(after.isActive
      ? AUDIT_ACTIONS.DICTIONARY_ITEM_REOPENED
      : AUDIT_ACTIONS.DICTIONARY_ITEM_CLOSED);
  }

  for (const action of actions) {
    await logAction({
      userId: author.id, userLogin: author.login, userRole: author.role,
      action, entityType: 'DictionaryItem', entityId: after.id,
      before, after, ip: clientIp(req),
    });
  }

  res.json(after);
};
