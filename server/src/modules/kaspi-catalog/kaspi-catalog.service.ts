import {
  LISTING_STATUSES,
  type KaspiCatalogOffer,
  type KaspiCatalogPreview,
  type KaspiCatalogSummary,
  type KaspiCatalogWarehouse,
} from '@radeya/shared';

import { ConflictError } from '../../lib/errors';
import { parseKaspiCatalog } from './kaspi-catalog.parser';

/**
 * Предпросмотр каталога Kaspi по двум выгрузкам.
 *
 * В базу ничего не пишется — это сознательно: сначала глазами проверяем,
 * что разобралось верно, и только потом заводим сохранение.
 */
export function buildCatalogPreview(input: {
  active?: string;
  archive?: string;
}): KaspiCatalogPreview {
  const offers: KaspiCatalogOffer[] = [
    ...(input.active
      ? parseKaspiCatalog(input.active, LISTING_STATUSES.ON_SALE)
      : []),
    ...(input.archive
      ? parseKaspiCatalog(input.archive, LISTING_STATUSES.OFF_SALE)
      : []),
  ];

  markDuplicateSkus(offers);

  return {
    offers,
    summary: summarize(offers),
    parsedAt: new Date().toISOString(),
  };
}

/**
 * Один артикул не может быть и в продаже, и в архиве одновременно.
 * Если такое встретилось, сохранять вслепую нельзя — сначала разобраться.
 */
function markDuplicateSkus(offers: KaspiCatalogOffer[]): void {
  const seen = new Map<string, KaspiCatalogOffer>();

  for (const offer of offers) {
    if (!offer.sku) continue;

    const previous = seen.get(offer.sku);

    if (previous) {
      const message = `Артикул встречается дважды: ${previous.status} и ${offer.status}`;
      previous.problems.push(message);
      offer.problems.push(message);
      continue;
    }

    seen.set(offer.sku, offer);
  }
}

function summarize(offers: KaspiCatalogOffer[]): KaspiCatalogSummary {
  const warehouses = new Map<string, KaspiCatalogWarehouse>();

  for (const offer of offers) {
    for (const stock of offer.stocks) {
      const existing = warehouses.get(stock.warehouseCode);

      if (existing) {
        existing.offersCount += 1;
        // Город берём из первой встреченной записи, где он вообще указан.
        existing.cityId ??= stock.cityId;
        continue;
      }

      warehouses.set(stock.warehouseCode, {
        code: stock.warehouseCode,
        storeId: stock.storeId,
        cityId: stock.cityId,
        offersCount: 1,
      });
    }
  }

  return {
    total: offers.length,
    onSale: offers.filter((o) => o.status === LISTING_STATUSES.ON_SALE).length,
    offSale: offers.filter((o) => o.status === LISTING_STATUSES.OFF_SALE).length,
    inStock: offers.filter((o) => o.totalStock > 0).length,
    preOrder: offers.filter((o) => o.isPreOrder).length,
    withProblems: offers.filter((o) => o.problems.length > 0).length,
    warehouses: [...warehouses.values()].sort((a, b) =>
      a.code.localeCompare(b.code),
    ),
  };
}

/** Ни одного файла не прислали — считать нечего. */
export function assertHasFiles(input: { active?: string; archive?: string }) {
  if (!input.active && !input.archive) {
    throw new ConflictError('Загрузите хотя бы один файл выгрузки');
  }
}
