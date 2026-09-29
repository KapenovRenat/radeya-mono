import type { RequestHandler } from 'express';
import { AUDIT_ACTIONS, HISTORY_SOURCES } from '@radeya/shared';

import { clientIp, logAction } from '../../lib/audit';
import { ValidationError } from '../../lib/errors';
import {
  commitMoyskladSchema,
  commitStockSchema,
  previewMoyskladSchema,
  previewStockSchema,
} from './moysklad.schemas';
import { commitMoyskladImport, previewMoyskladImport } from './moysklad.service';
import { commitStockImport, previewStockImport } from './moysklad-stock.service';

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
  const result = await commitMoyskladImport(parsed.data, {
    author, source: HISTORY_SOURCES.IMPORT, ip: clientIp(req),
  });

  // Сводка одной строкой в журнал действий — счётчики и лист. Что именно
  // поменялось у каждого товара, записано в его историю внутри импорта.
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

/**
 * Разбор отчёта «Остатки» для выбранного склада. **В базу не пишет.**
 * Без `?sheet=` отдаёт только список листов.
 */
export const previewStock: RequestHandler = async (req, res) => {
  const parsed = previewStockSchema.safeParse(req.query);

  if (!parsed.success) throw new ValidationError('Выберите склад и лист');

  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new ValidationError('Файл не получен');
  }

  res.json(await previewStockImport(req.body, parsed.data));
};

/** Запись остатков в выбранный склад и обнуление того, чего в отчёте нет. */
export const commitStock: RequestHandler = async (req, res) => {
  const parsed = commitStockSchema.safeParse(req.body);

  if (!parsed.success) throw new ValidationError('Проверьте склад, лист и строки');

  const author = req.user!;
  const result = await commitStockImport(parsed.data, {
    author, source: HISTORY_SOURCES.IMPORT, ip: clientIp(req),
  });

  await logAction({
    userId: author.id, userLogin: author.login, userRole: author.role,
    action: AUDIT_ACTIONS.MOYSKLAD_STOCK_IMPORTED, entityType: 'Warehouse',
    entityId: parsed.data.warehouseId,
    after: {
      sheet: parsed.data.sheet,
      stockAt: parsed.data.stockAt,
      updated: result.updated,
      zeroed: result.zeroed,
      costsSet: result.costsSet,
      failed: result.failed.length,
    },
    ip: clientIp(req),
  });

  res.status(201).json(result);
};
