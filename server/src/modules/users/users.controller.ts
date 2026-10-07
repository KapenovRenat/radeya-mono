import type { Request, RequestHandler } from 'express';
import { AUDIT_ACTIONS, normalizePermissions } from '@radeya/shared';

import { clientIp, logAction } from '../../lib/audit';
import { ValidationError } from '../../lib/errors';
import type { User } from '../../generated/prisma/client';
import { createUserSchema, updateUserSchema, userParamsSchema } from './users.schemas';
import { createUser, deleteUser, listUsers, toUserListItem, updateUser } from './users.service';

/** GET /api/users */
export const getUsers: RequestHandler = async (_req, res) => {
  res.json({ items: await listUsers() });
};

/** POST /api/users */
export const postUser: RequestHandler = async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);

  if (!parsed.success) throw new ValidationError('Проверьте заполнение полей', fieldDetails(parsed.error.issues));

  // requireAuth гарантирует наличие пользователя, но TypeScript об этом не знает.
  const author = req.user!;
  const created = await createUser(parsed.data, author);

  // Пароль и хеш в журнал не попадают — только то, что можно показать в истории.
  await logUser(req, AUDIT_ACTIONS.USER_CREATED, created.id, undefined, journalCard(created));

  res.status(201).json(toUserListItem(created));
};

/** PATCH /api/users/:id — имя, должность, роль, права, новый пароль. */
export const patchUser: RequestHandler = async (req, res) => {
  const params = userParamsSchema.safeParse(req.params);

  if (!params.success) throw new ValidationError('Некорректный сотрудник');

  const parsed = updateUserSchema.safeParse(req.body);

  if (!parsed.success) throw new ValidationError('Проверьте заполнение полей', fieldDetails(parsed.error.issues));

  const { before, after } = await updateUser(params.data.id, parsed.data, req.user!);

  await logUser(req, AUDIT_ACTIONS.USER_UPDATED, after.id, journalCard(before), {
    ...journalCard(after),
    // Сам пароль в журнал не пишется — только факт смены.
    ...(parsed.data.password !== undefined ? { passwordChanged: true } : {}),
  });

  res.json(toUserListItem(after));
};

/** DELETE /api/users/:id — насовсем. */
export const removeUser: RequestHandler = async (req, res) => {
  const params = userParamsSchema.safeParse(req.params);

  if (!params.success) throw new ValidationError('Некорректный сотрудник');

  const deleted = await deleteUser(params.data.id, req.user!);

  // Карточка снимком: после удаления в базе её больше нет, остаётся только журнал.
  await logUser(req, AUDIT_ACTIONS.USER_DELETED, deleted.id, journalCard(deleted), undefined);

  res.status(204).end();
};

/** Что о сотруднике видно в журнале: без пароля и хеша. */
function journalCard(user: User) {
  return {
    login: user.login,
    name: user.name,
    position: user.position,
    role: user.role,
    permissions: normalizePermissions(user.permissions),
  };
}

async function logUser(req: Request, action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS],
  entityId: string, before: unknown, after: unknown): Promise<void> {
  const author = req.user!;

  await logAction({
    userId: author.id, userLogin: author.login, userRole: author.role,
    action, entityType: 'User', entityId, before, after, ip: clientIp(req),
  });
}

/** Поле → список претензий: форма покажет ошибку под нужным полем. */
function fieldDetails(issues: { path: PropertyKey[]; message: string }[]): Record<string, string[]> {
  const details: Record<string, string[]> = {};

  for (const issue of issues) {
    const field = issue.path.map(String).join('.') || 'form';
    details[field] = [...(details[field] ?? []), issue.message];
  }

  return details;
}
