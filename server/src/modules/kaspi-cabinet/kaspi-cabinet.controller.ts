import type { RequestHandler } from 'express';
import { AUDIT_ACTIONS, type KaspiCabinetCheckResponse } from '@radeya/shared';

import { clientIp, logAction } from '../../lib/audit';
import { ValidationError } from '../../lib/errors';
import { getCabinetAccount, saveCabinetAccount } from './cabinet-account.service';
import { checkCabinetConnection } from './cabinet-session.service';
import { saveCabinetAccountSchema } from './kaspi-cabinet.schemas';

/** GET /api/kaspi-cabinet/account — email и состояние входа, без пароля. */
export const getAccount: RequestHandler = async (_req, res) => {
  res.json(await getCabinetAccount());
};

/** PUT /api/kaspi-cabinet/account — сохранить email и пароль. Входа здесь нет. */
export const putAccount: RequestHandler = async (req, res) => {
  const parsed = saveCabinetAccountSchema.safeParse(req.body);

  if (!parsed.success) throw new ValidationError('Проверьте email и пароль');

  const { previousEmail, account } = await saveCabinetAccount(parsed.data);
  const author = req.user!;

  // Пароль в журнал не попадает ни в каком виде — только факт смены и email.
  await logAction({
    userId: author.id, userLogin: author.login, userRole: author.role,
    action: AUDIT_ACTIONS.KASPI_CABINET_ACCOUNT_SAVED, entityType: 'KaspiCabinetAccount',
    before: previousEmail === null ? undefined : { email: previousEmail },
    after: { email: account.email },
    ip: clientIp(req),
  });

  res.json(account);
};

/** POST /api/kaspi-cabinet/check — проверка подключения с трассой ответов Kaspi. */
export const postCheck: RequestHandler = async (req, res) => {
  const result = await checkCabinetConnection();
  const author = req.user!;

  // Трасса в журнал не идёт: журнал не хранилище, а в ответах Kaspi — данные кабинета.
  await logAction({
    userId: author.id, userLogin: author.login, userRole: author.role,
    action: AUDIT_ACTIONS.KASPI_CABINET_CHECKED, entityType: 'KaspiCabinetAccount',
    after: { status: result.status, loggedIn: result.loggedIn },
    ip: clientIp(req),
  });

  const body: KaspiCabinetCheckResponse = { ...result, account: await getCabinetAccount() };

  res.json(body);
};
