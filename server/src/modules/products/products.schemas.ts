import { z } from 'zod';

import { LISTING_STATUSES } from '@radeya/shared';

/**
 * Импорт товаров из кабинета Kaspi.
 *
 * Список приходит с клиента уже разобранным — ровно тот, что человек видел
 * в таблице перед нажатием кнопки. Поэтому проверяем каждое поле: эндпоинт
 * доступен только админу, но «свой пользователь» не заменяет валидацию.
 * Кривой артикул попадёт в каталог навсегда и потянет за собой заказы.
 *
 * Неописанные здесь поля `CabinetOffer` zod отбрасывает сам — в базу едет
 * только то, что перечислено.
 */

/** Артикул Kaspi. Длиннее сотни символов не встречается даже близко. */
const SKU_MAX = 100;

/** Текстовые поля кабинета: названия бывают длинными, но не безразмерными. */
const TEXT_MAX = 500;

/**
 * Потолок на один запрос. Каталог — полторы тысячи позиций; пять тысяч уже
 * означают, что пришло что-то не то, и заливать это в базу не нужно.
 */
const MAX_OFFERS = 5000;

/** История изменений кабинета: храним снимком, но не бесконечный. */
const MAX_UPDATES = 500;

const nullableText = (max = TEXT_MAX) => z.string().trim().max(max).nullable();

/** Цена в тенге. Отрицательной не бывает, дробной у Kaspi тоже. */
const priceSchema = z.number().int().nonnegative().nullable();

const imageSchema = z.object({
  small: z.string().trim().max(TEXT_MAX).nullable(),
  medium: z.string().trim().max(TEXT_MAX).nullable(),
  large: z.string().trim().max(TEXT_MAX).nullable(),
});

const deliverySchema = z.object({
  any: z.boolean(),
  express: z.boolean(),
  local: z.boolean(),
  merchant: z.boolean(),
});

const stockSchema = z.object({
  warehouseCode: z.string().trim().regex(/^PP\d{1,4}$/, 'Код склада ожидается в виде PP3'),
  storeId: z.string().trim().max(SKU_MAX),
  /** Пусто — остаток не указан: товар под заказ. Это не ноль. */
  quantity: z.number().int().nullable(),
  preOrderDays: z.number().int().min(0).max(365),
});

const offerSchema = z.object({
  sku: z.string().trim().min(1, 'Товар без артикула').max(SKU_MAX),

  masterSku: nullableText(SKU_MAX),
  offerId: nullableText(SKU_MAX),
  fileId: nullableText(SKU_MAX),
  merchantUid: nullableText(SKU_MAX),

  title: z.string().trim().max(TEXT_MAX),
  masterTitle: nullableText(),
  model: nullableText(),
  brand: nullableText(),

  barcode: nullableText(SKU_MAX),

  price: priceSchema,
  discountPrice: priceSchema,
  discountPercent: z.number().int().min(0).max(100),

  images: z.array(imageSchema).max(50),

  status: z.enum([LISTING_STATUSES.ON_SALE, LISTING_STATUSES.OFF_SALE]),

  delivery: deliverySchema,

  stocks: z.array(stockSchema).max(100),

  familyId: nullableText(),
  shopLink: nullableText(),
  updatedAt: nullableText(),

  updates: z.array(z.unknown()).max(MAX_UPDATES),
});

export const importKaspiProductsSchema = z.object({
  offers: z
    .array(offerSchema)
    .min(1, 'Список товаров пуст')
    .max(MAX_OFFERS, `Не больше ${MAX_OFFERS} товаров за раз`),
});

export type ImportKaspiProductsInput = z.infer<typeof importKaspiProductsSchema>;
export type ImportOfferInput = z.infer<typeof offerSchema>;
