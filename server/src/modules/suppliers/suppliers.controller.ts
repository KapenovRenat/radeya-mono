import type { RequestHandler } from 'express';
import { AUDIT_ACTIONS, HISTORY_SOURCES } from '@radeya/shared';

import { clientIp, logAction } from '../../lib/audit';
import { ValidationError } from '../../lib/errors';
import {
  commitSuppliersSchema,
  previewSuppliersSchema,
  supplierParamsSchema,
  updateSupplierSchema,
} from './suppliers.schemas';
import {
  commitSupplierImport,
  listSuppliers,
  previewSupplierImport,
  updateSupplier,
} from './suppliers.service';

export const getSuppliers: RequestHandler = async (_req, res) => {
  res.json(await listSuppliers());
};

/**
 * Разбор выгрузки контрагентов. **В базу не пишет.**
 *
 * Без `?sheet=` отдаёт только список листов — тот же порядок, что у импорта
 * продаж, чтобы два блока на странице вели себя одинаково.
 */
export const previewSuppliers: RequestHandler = async (req, res) => {
  const parsed = previewSuppliersSchema.safeParse(req.query);

  if (!parsed.success) throw new ValidationError('Проверьте название листа');

  // express.raw кладёт тело Buffer'ом; пустое тело означает, что файл не дошёл.
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new ValidationError('Файл не получен');
  }

  res.json(await previewSupplierImport(req.body, parsed.data));
};

/** Запись разобранных строк в справочник поставщиков. */
export const commitSuppliers: RequestHandler = async (req, res) => {
  const parsed = commitSuppliersSchema.safeParse(req.body);

  if (!parsed.success) throw new ValidationError('Проверьте лист и строки');

  const author = req.user!;
  const result = await commitSupplierImport(parsed.data, {
    author, source: HISTORY_SOURCES.IMPORT, ip: clientIp(req),
  });

  // В журнал — счётчики и лист, без самих строк: журнал не хранилище.
  await logAction({
    userId: author.id, userLogin: author.login, userRole: author.role,
    action: AUDIT_ACTIONS.SUPPLIERS_IMPORTED, entityType: 'Supplier',
    after: {
      sheet: parsed.data.sheet,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      failed: result.failed.length,
    },
    ip: clientIp(req),
  });

  res.status(201).json(result);
};

export const patchSupplier: RequestHandler = async (req, res) => {
  const params = supplierParamsSchema.safeParse(req.params);

  if (!params.success) throw new ValidationError('Некорректный идентификатор поставщика');

  const parsed = updateSupplierSchema.safeParse(req.body);

  if (!parsed.success) throw new ValidationError('Проверьте поля карточки');

  const author = req.user!;
  const { before, after } = await updateSupplier(params.data.id, parsed.data, {
    author, source: HISTORY_SOURCES.MANUAL, ip: clientIp(req),
  });

  await logAction({
    userId: author.id, userLogin: author.login, userRole: author.role,
    action: AUDIT_ACTIONS.SUPPLIER_UPDATED, entityType: 'Supplier', entityId: after.id,
    before, after,
    ip: clientIp(req),
  });

  res.json(after);
};
