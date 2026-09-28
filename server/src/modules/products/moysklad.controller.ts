import type { RequestHandler } from 'express';
import { AUDIT_ACTIONS } from '@radeya/shared';

import { clientIp, logAction } from '../../lib/audit';
import { ValidationError } from '../../lib/errors';
import { commitMoyskladSchema, previewMoyskladSchema } from './moysklad.schemas';
import { commitMoyskladImport, previewMoyskladImport } from './moysklad.service';

/**
 * Разбор выгрузки товаров МойСклада. **В базу не пишет** — только читает,
 * чтобы показать, что нашлось в каталоге, а что нет.
 */
export const previewMoysklad: RequestHandler = async (req, res) => {
  const parsed = previewMoyskladSchema.safeParse(req.query);

  if (!parsed.success) throw new ValidationError('Проверьте название листа');

  // express.raw кладёт тело Buffer'ом; пустое тело означает, что файл не дошёл.
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new ValidationError('Файл не получен');
  }

  res.json(await previewMoyskladImport(req.body, parsed.data));
};

/** Запись закупки, поставщиков и сроков предзаказа в найденные артикулы. */
export const commitMoysklad: RequestHandler = async (req, res) => {
  const parsed = commitMoyskladSchema.safeParse(req.body);

  if (!parsed.success) throw new ValidationError('Проверьте лист и строки');

  const author = req.user!;
  const result = await commitMoyskladImport(parsed.data);

  // В журнал — счётчики и лист, без самих строк: закупочные цены полутора тысяч
  // артикулов в журнале не нужны, а весит это мегабайты.
  await logAction({
    userId: author.id, userLogin: author.login, userRole: author.role,
    action: AUDIT_ACTIONS.MOYSKLAD_PRODUCTS_IMPORTED, entityType: 'Variant',
    after: {
      sheet: parsed.data.sheet,
      updated: result.updated,
      pricesSet: result.pricesSet,
      suppliersSet: result.suppliersSet,
      stocksSet: result.stocksSet,
      failed: result.failed.length,
    },
    ip: clientIp(req),
  });

  res.status(201).json(result);
};
