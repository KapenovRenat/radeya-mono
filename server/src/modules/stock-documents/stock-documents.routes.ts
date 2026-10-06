import { Router } from 'express';
import { STOCK_DOCUMENT_ROLES } from '@radeya/shared';

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
 * поэтому раздел закрыт ролями STOCK_DOCUMENT_ROLES. Проведение — галочкой
 * `post` в POST/PUT, право STOCK_DOCUMENT_POST_ROLES проверяет контроллер.
 * Роли — в shared, фронт прячет галочку по тем же.
 */
export const stockDocumentsRouter = Router();

// Весь модуль — только своим ролям. Маршрут без своего can() не станет шире.
stockDocumentsRouter.use(can(STOCK_DOCUMENT_ROLES));

stockDocumentsRouter.get('/', can(STOCK_DOCUMENT_ROLES), getStockDocuments);
// До `/:number`, иначе «variants» попадёт в номер документа.
stockDocumentsRouter.get('/variants', can(STOCK_DOCUMENT_ROLES), getStockPickerVariants);
stockDocumentsRouter.post('/', can(STOCK_DOCUMENT_ROLES), postStockDocumentDraft);
stockDocumentsRouter.get('/:number', can(STOCK_DOCUMENT_ROLES), getStockDocumentByNumber);
stockDocumentsRouter.put('/:number', can(STOCK_DOCUMENT_ROLES), putStockDocumentDraft);
stockDocumentsRouter.delete('/:number', can(STOCK_DOCUMENT_ROLES), deleteStockDocumentDraft);
