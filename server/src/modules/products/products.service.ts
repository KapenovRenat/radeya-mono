import {
  SALES_CHANNELS,
  type ImportKaspiProductsResponse,
} from '@radeya/shared';

import { prisma } from '../../db/client';
import { logger } from '../../lib/logger';
import type { ImportKaspiProductsInput, ImportOfferInput } from './products.schemas';
import type { Prisma } from '../../generated/prisma/client';

/**
 * Каталог: сохранение товаров, приехавших из кабинета Kaspi.
 *
 * Правило импорта одно: **создаём только новое**. Товар, который уже есть
 * в базе по артикулу, пропускается целиком — у него уже может быть наша
 * категория, ткань, закупочная цена и цена сайта, и затирать это выгрузкой
 * нельзя. Обновление полей кабинета будет отдельной операцией с показом
 * расхождений, а не молчаливой перезаписью.
 */

/** Известные артикулы — по ним фронт прячет из таблицы уже сохранённое. */
export async function listKnownSkus(): Promise<string[]> {
  const variants = await prisma.variant.findMany({ select: { sku: true } });

  return variants.map((variant) => variant.sku);
}

export async function importKaspiProducts(
  input: ImportKaspiProductsInput,
  authorId: string,
): Promise<ImportKaspiProductsResponse> {
  const offers = dedupeBySku(input.offers);

  const existing = await prisma.variant.findMany({
    where: { sku: { in: offers.map((offer) => offer.sku) } },
    select: { sku: true },
  });

  const known = new Set(existing.map((variant) => variant.sku));
  const warehouses = await loadWarehouses();

  const missingWarehouses = new Set<string>();
  const failed: ImportKaspiProductsResponse['failed'] = [];

  let created = 0;
  let skipped = 0;

  for (const offer of offers) {
    if (known.has(offer.sku)) {
      skipped += 1;
      continue;
    }

    try {
      await createProduct(offer, warehouses, missingWarehouses, authorId);
      created += 1;
    } catch (error) {
      // Одна плохая запись не должна отменять весь импорт: полторы тысячи
      // товаров ради одной строки заливать заново — дороже, чем показать список.
      const reason = error instanceof Error ? error.message : 'неизвестная ошибка';

      logger.error(`Каталог: товар ${offer.sku} не сохранён`, reason);
      failed.push({ sku: offer.sku, reason });
    }
  }

  logger.info(
    `Каталог: импорт из Kaspi — создано ${created}, пропущено ${skipped}, с ошибкой ${failed.length}`,
  );

  return {
    created,
    skipped,
    failed,
    missingWarehouses: [...missingWarehouses].sort(),
  };
}

/**
 * Один товар кабинета — это карточка, модификация, размещение на Kaspi
 * и остатки по складам. Всё одной вложенной вставкой: Prisma выполнит её
 * в транзакции, и товар без модификации в базе не появится.
 */
async function createProduct(
  offer: ImportOfferInput,
  warehouses: Map<string, string>,
  missingWarehouses: Set<string>,
  authorId: string,
): Promise<void> {
  const stocks = offer.stocks.filter((stock) => {
    const known = warehouses.has(stock.warehouseCode);

    // Склад, которого нет в справочнике, не выдумываем: сначала «Сохранить
    // склады», потом товары. Иначе опечатка в коде заведёт фантомную точку.
    if (!known) missingWarehouses.add(stock.warehouseCode);

    return known;
  });

  await prisma.product.create({
    data: {
      // Название витрины ближе к человеческому, чем наше из выгрузки.
      // Везде `||`, а не `??`: пустая строка — это тоже «названия нет».
      name: offer.masterTitle || offer.title || offer.sku,
      brand: offer.brand,
      kaspiFamilyId: offer.familyId,
      createdById: authorId,

      variants: {
        create: {
          sku: offer.sku,
          barcode: offer.barcode,

          kaspiMasterTitle: offer.masterTitle,
          kaspiTitle: offer.title || null,
          kaspiModel: offer.model,
          kaspiMasterSku: offer.masterSku,
          kaspiOfferId: offer.offerId,
          kaspiFileId: offer.fileId,
          kaspiMerchantUid: offer.merchantUid,
          kaspiShopLink: offer.shopLink,
          kaspiImages: toJson(offer.images),
          kaspiUpdates: toJson(offer.updates),
          kaspiUpdatedAt: toDate(offer.updatedAt),

          // Архивный товар кабинета заводится снятым, а не активным:
          // иначе он попадёт в будущую выгрузку на площадки как продаваемый.
          status: offer.status,

          anyKaspiDelivery: offer.delivery.any,
          anyKaspiDeliveryExpress: offer.delivery.express,
          anyKaspiDeliveryLocal: offer.delivery.local,
          anyMerchantDelivery: offer.delivery.merchant,

          // Цены по каналам на входе одни — Kaspi. Минимум и максимум
          // пересчитаются, как только появится цена сайта.
          minChannelPrice: offer.discountPrice ?? offer.price,
          maxChannelPrice: offer.price ?? offer.discountPrice,

          listings: {
            create: {
              channel: SALES_CHANNELS.KASPI,
              status: offer.status,
              price: offer.price,
              discountPrice: offer.discountPrice,
              discountPercent: offer.discountPercent,
              externalId: offer.offerId,
              externalSku: offer.masterSku,
              externalUrl: offer.shopLink,
              lastSyncedAt: new Date(),
            },
          },

          stocks: {
            create: stocks.map((stock) => ({
              warehouseId: warehouses.get(stock.warehouseCode)!,
              quantity: stock.quantity,
              // Первое значение приезжает из кабинета, дальше правится у нас.
              preOrderDays: stock.preOrderDays,
            })),
          },
        },
      },
    },
  });
}

/** Справочник складов кодом → id. Читается один раз на весь импорт. */
async function loadWarehouses(): Promise<Map<string, string>> {
  const warehouses = await prisma.warehouse.findMany({
    select: { id: true, code: true },
  });

  return new Map(warehouses.map((warehouse) => [warehouse.code, warehouse.id]));
}

/**
 * Один артикул в запросе может встретиться дважды: в кабинете он бывает
 * и в продаже, и в архиве. Берём первое вхождение — иначе вставка упадёт
 * на уникальном индексе посреди импорта.
 */
function dedupeBySku(offers: ImportOfferInput[]): ImportOfferInput[] {
  const seen = new Set<string>();

  return offers.filter((offer) => {
    if (seen.has(offer.sku)) return false;

    seen.add(offer.sku);

    return true;
  });
}

/**
 * Значение для Json-поля.
 *
 * История изменений кабинета приходит как `unknown[]` — формат недокументирован,
 * и разбирать его наугад мы не будем. Прогон через JSON отсекает `undefined`
 * и функции: в базе им делать нечего, а Prisma на них падает.
 */
function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? [])) as Prisma.InputJsonValue;
}

/** Дата кабинета приходит строкой с наносекундами — их Date не понимает. */
function toDate(value: string | null): Date | null {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}
