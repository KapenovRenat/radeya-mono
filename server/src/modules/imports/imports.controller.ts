import type { RequestHandler } from 'express';
import { AUDIT_ACTIONS } from '@radeya/shared';

import { clientIp, logAction } from '../../lib/audit';
import { ValidationError } from '../../lib/errors';
import { commitImportSchema, previewImportSchema } from './imports.schemas';
import { commitOfflineImport, previewOfflineImport } from './imports.service';

/**
 * Разбор книги Excel. **В базу не пишет.**
 *
 * Без `?sheet=` отдаёт только список листов: в рабочей книге их сотня,
 * и разбирать наугад нечего.
 */
export const previewOfflineOrders: RequestHandler = async (req, res) => {
  const parsed = previewImportSchema.safeParse(req.query);

  if (!parsed.success) throw new ValidationError('Проверьте название листа');

  // express.raw кладёт тело Buffer'ом; пустое тело означает, что файл не дошёл.
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new ValidationError('Файл не получен');
  }

  res.json(await previewOfflineImport(req.body, parsed.data));
};

/** Запись разобранных строк в заказы выбранной офлайн-точки. */
export const commitOfflineOrders: RequestHandler = async (req, res) => {
  const parsed = commitImportSchema.safeParse(req.body);

  if (!parsed.success) throw new ValidationError('Проверьте точку продаж, лист и строки');

  const author = req.user!;
  const result = await commitOfflineImport(parsed.data, author);

  // В журнал — счётчики и название листа, без самих строк: там персональные
  // данные покупателей, а журнал не хранилище.
  await logAction({
    userId: author.id, userLogin: author.login, userRole: author.role,
    action: AUDIT_ACTIONS.OFFLINE_ORDERS_IMPORTED, entityType: 'Order',
    after: {
      salesPointId: parsed.data.salesPointId,
      sheet: parsed.data.sheet,
      created: result.created,
      failed: result.failed.length,
    },
    ip: clientIp(req),
  });

  res.status(201).json(result);
};
