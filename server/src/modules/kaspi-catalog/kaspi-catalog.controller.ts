import type { RequestHandler } from 'express';
import { AUDIT_ACTIONS } from '@radeya/shared';

import { clientIp, logAction } from '../../lib/audit';
import { ValidationError } from '../../lib/errors';
import { fetchCabinetSchema } from './kaspi-cabinet.schemas';
import { fetchCabinetCatalog } from './kaspi-cabinet.service';
import { assertHasFiles, buildCatalogPreview } from './kaspi-catalog.service';

/** POST /api/kaspi-catalog/preview */
export const previewCatalog: RequestHandler = async (req, res) => {
  const body = req.body as { active?: unknown; archive?: unknown };

  const active = readXml(body.active, 'active');
  const archive = readXml(body.archive, 'archive');

  assertHasFiles({ active, archive });

  const preview = buildCatalogPreview({ active, archive });

  const author = req.user!;

  await logAction({
    userId: author.id,
    userLogin: author.login,
    userRole: author.role,
    action: AUDIT_ACTIONS.KASPI_CATALOG_PREVIEW,
    // Содержимое файлов в журнал не кладём — только итог разбора.
    after: {
      total: preview.summary.total,
      onSale: preview.summary.onSale,
      offSale: preview.summary.offSale,
      withProblems: preview.summary.withProblems,
    },
    ip: clientIp(req),
  });

  res.json(preview);
};

/** POST /api/kaspi-catalog/fetch */
export const fetchCatalog: RequestHandler = async (req, res) => {
  const parsed = fetchCabinetSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError('Проверьте параметры загрузки');
  }

  const result = await fetchCabinetCatalog(parsed.data);

  const author = req.user!;

  await logAction({
    userId: author.id,
    userLogin: author.login,
    userRole: author.role,
    action: AUDIT_ACTIONS.KASPI_CABINET_FETCH,
    // Куку в журнал не кладём ни при каких условиях — это доступ в кабинет.
    after: {
      total: result.total,
      pages: result.pages,
      stoppedAtPage: result.stoppedAtPage,
    },
    ip: clientIp(req),
  });

  res.json(result);
};

function readXml(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;

  if (typeof value !== 'string') {
    throw new ValidationError(`Поле ${field} должно быть содержимым XML-файла`);
  }

  return value;
}
