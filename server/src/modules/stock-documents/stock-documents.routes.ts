import { Router } from 'express';
import { PERMISSIONS } from '@radeya/shared';

import { can } from '../../middlewares/require-auth';
import {
  deleteStockDocumentDraft,
  getStockDocumentByNumber,
  getStockDocuments,
  getStockPickerVariants,
  postStockDocumentDraft,
  putStockDocumentDraft,
} from './stock-documents.controller';

/**
 * Документы склада: оприходование и списание. В документе видна себестоимость,
 * поэтому раздел закрыт правом STOCK_DOCUMENTS_VIEW, правка — STOCK_DOCUMENTS_EDIT. Проведение — галочкой
 * `post` в POST/PUT, право STOCK_DOCUMENTS_POST проверяет контроллер.
 * Роли — в shared, фронт прячет галочку по тем же.
 */
export const stockDocumentsRouter = Router();

// Весь модуль — только с правом видеть. Маршрут без своего can() не станет шире.
stockDocumentsRouter.use(can(PERMISSIONS.STOCK_DOCUMENTS_VIEW));

stockDocumentsRouter.get('/', can(PERMISSIONS.STOCK_DOCUMENTS_VIEW), getStockDocuments);
// До `/:number`, иначе «variants» попадёт в номер документа.
stockDocumentsRouter.get('/variants', can(PERMISSIONS.STOCK_DOCUMENTS_EDIT), getStockPickerVariants);
stockDocumentsRouter.post('/', can(PERMISSIONS.STOCK_DOCUMENTS_EDIT), postStockDocumentDraft);
stockDocumentsRouter.get('/:number', can(PERMISSIONS.STOCK_DOCUMENTS_VIEW), getStockDocumentByNumber);
stockDocumentsRouter.put('/:number', can(PERMISSIONS.STOCK_DOCUMENTS_EDIT), putStockDocumentDraft);
stockDocumentsRouter.delete('/:number', can(PERMISSIONS.STOCK_DOCUMENTS_EDIT), deleteStockDocumentDraft);
