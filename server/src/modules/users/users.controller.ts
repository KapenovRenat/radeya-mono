import type { RequestHandler } from 'express';
import { AUDIT_ACTIONS } from '@radeya/shared';

import { clientIp, logAction } from '../../lib/audit';
import { ValidationError } from '../../lib/errors';
import { createUserSchema } from './users.schemas';
import { createUser, listUsers, toUserListItem } from './users.service';

/** GET /api/users */
export const getUsers: RequestHandler = async (_req, res) => {
  res.json({ items: await listUsers() });
};

/** POST /api/users */
export const postUser: RequestHandler = async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);

  if (!parsed.success) {
    // Поле → список претензий: форма покажет ошибку под нужным полем.
    const details: Record<string, string[]> = {};

    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.') || 'form';
      details[field] = [...(details[field] ?? []), issue.message];
    }

    throw new ValidationError('Проверьте заполнение полей', details);
  }

  // requireAuth гарантирует наличие пользователя, но TypeScript об этом не знает.
  const author = req.user!;
  const created = await createUser(parsed.data, author.id);

  await logAction({
    userId: author.id,
    userLogin: author.login,
    userRole: author.role,
    action: AUDIT_ACTIONS.USER_CREATED,
    entityType: 'User',
    entityId: created.id,
    // Пароль и хеш в журнал не попадают — только то, что можно показать в истории.
    after: {
      login: created.login,
      name: created.name,
      position: created.position,
      role: created.role,
    },
    ip: clientIp(req),
  });

  res.status(201).json(toUserListItem(created));
};
