import type { Request, RequestHandler } from 'express';
import {
  AUDIT_ACTIONS,
  HISTORY_SOURCES,
  PERMISSIONS,
  formatStockDocumentNumber,
  hasPermission,
  type AuditAction,
  type StockDocumentDto,
} from '@radeya/shared';

import { clientIp, logAction } from '../../lib/audit';
import { ForbiddenError, ValidationError } from '../../lib/errors';
import {
  saveStockDocumentSchema,
  stockDocumentListQuerySchema,
  stockDocumentParamsSchema,
  stockPickerQuerySchema,
} from './stock-documents.schemas';
import {
  createStockDocument,
  deleteStockDocument,
  getStockDocument,
  listStockDocuments,
  listStockPickerVariants,
  updateStockDocument,
} from './stock-documents.service';

/** GET /api/stock-documents */
export const getStockDocuments: RequestHandler = async (req, res) => {
  const parsed = stockDocumentListQuerySchema.safeParse(req.query);

  if (!parsed.success) throw new ValidationError('Проверьте фильтры списка документов');

  res.json(await listStockDocuments(parsed.data));
};

/** GET /api/stock-documents/variants — товары для окна выбора. */
export const getStockPickerVariants: RequestHandler = async (req, res) => {
  const parsed = stockPickerQuerySchema.safeParse(req.query);

  if (!parsed.success) throw new ValidationError('Проверьте склад и строку поиска');

  res.json(await listStockPickerVariants(parsed.data));
};

/** GET /api/stock-documents/:number */
export const getStockDocumentByNumber: RequestHandler = async (req, res) => {
  res.json(await getStockDocument(readNumber(req)));
};

/** POST /api/stock-documents — новый документ; с `post: true` — сразу проведённый. */
export const postStockDocumentDraft: RequestHandler = async (req, res) => {
  const input = readDocument(req);
  const document = await createStockDocument(input, historyMeta(req));

  await logDocument(req, AUDIT_ACTIONS.STOCK_DOCUMENT_CREATED, document);
  if (input.post) await logDocument(req, AUDIT_ACTIONS.STOCK_DOCUMENT_POSTED, document);

  res.status(201).json(document);
};

/** PUT /api/stock-documents/:number — правка черновика целиком; с `post: true` — и проведение. */
export const putStockDocumentDraft: RequestHandler = async (req, res) => {
  const number = readNumber(req);
  const input = readDocument(req);
  const document = await updateStockDocument(number, input, historyMeta(req));

  await logDocument(req, AUDIT_ACTIONS.STOCK_DOCUMENT_UPDATED, document);
  if (input.post) await logDocument(req, AUDIT_ACTIONS.STOCK_DOCUMENT_POSTED, document);

  res.json(document);
};

/** DELETE /api/stock-documents/:number — удаление черновика. */
export const deleteStockDocumentDraft: RequestHandler = async (req, res) => {
  const document = await deleteStockDocument(readNumber(req));

  await logDocument(req, AUDIT_ACTIONS.STOCK_DOCUMENT_DELETED, document);

  res.status(204).end();
};

function readNumber(req: Request): number {
  const parsed = stockDocumentParamsSchema.safeParse(req.params);

  if (!parsed.success) throw new ValidationError('Некорректный номер документа');

  return parsed.data.number;
}

function readDocument(req: Request) {
  const parsed = saveStockDocumentSchema.safeParse(req.body);

  if (!parsed.success) {
    const details: Record<string, string[]> = {};

    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.') || 'form';
      details[field] = [...(details[field] ?? []), issue.message];
    }

    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Проверьте документ', details);
  }

  // Галочка «Проведено» меняет остатки — право проверяется здесь, на сервере:
  // спрятанная на фронте галочка ничего не закрывает.
  if (parsed.data.post && !hasPermission(req.user, PERMISSIONS.STOCK_DOCUMENTS_POST)) {
    throw new ForbiddenError('Нет права проводить документы склада');
  }

  return parsed.data;
}

function historyMeta(req: Request) {
  return { author: req.user!, source: HISTORY_SOURCES.MANUAL, ip: clientIp(req) };
}

/** В журнал — сводка документа, без строк: строки лежат в самом документе. */
async function logDocument(req: Request, action: AuditAction, document: StockDocumentDto): Promise<void> {
  const author = req.user!;

  await logAction({
    userId: author.id, userLogin: author.login, userRole: author.role,
    action, entityType: 'StockDocument', entityId: document.id,
    after: {
      number: formatStockDocumentNumber(document.number),
      type: document.type,
      warehouse: document.warehouse.code,
      lines: document.linesCount,
      totalAmount: document.totalAmount,
    },
    ip: clientIp(req),
  });
}
