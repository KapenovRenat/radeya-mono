import type { RequestHandler } from 'express';
import { AUDIT_ACTIONS } from '@radeya/shared';

import { clientIp, logAction } from '../../lib/audit';
import { ValidationError } from '../../lib/errors';
import { importKaspiProductsSchema } from './products.schemas';
import { importKaspiProducts, listKnownSkus } from './products.service';

/** GET /api/products/skus */
export const getKnownSkus: RequestHandler = async (_req, res) => {
  res.json({ skus: await listKnownSkus() });
};

/** POST /api/products/import-kaspi */
export const postImportKaspiProducts: RequestHandler = async (req, res) => {
  const parsed = importKaspiProductsSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError('Проверьте список товаров');
  }

  const author = req.user!;

  const result = await importKaspiProducts(parsed.data, author.id);

  await logAction({
    userId: author.id,
    userLogin: author.login,
    userRole: author.role,
    action: AUDIT_ACTIONS.KASPI_PRODUCTS_IMPORTED,
    // Сами товары в журнал не кладём — только итог: полторы тысячи записей
    // в одной строке журнала сделали бы его нечитаемым.
    after: {
      created: result.created,
      skipped: result.skipped,
      failed: result.failed.length,
    },
    ip: clientIp(req),
  });

  res.json(result);
};
