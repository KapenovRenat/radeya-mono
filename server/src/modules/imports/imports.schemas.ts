import { z } from 'zod';

/**
 * Разбор листа. Файл приезжает телом запроса, поэтому лист и точка продаж —
 * в параметрах адреса: смешивать двоичное тело с полями формы значило бы
 * тащить multipart ради двух строк.
 */
export const previewImportSchema = z.object({
  /** Не указан — отдаём только список листов, чтобы человек выбрал. */
  sheet: z.string().trim().min(1).max(200).optional(),
}).strict();

const money = z.string().regex(/^-?\d+\.\d{2}$/, 'Ожидается сумма с двумя знаками');
const optionalMoney = money.nullable();
const optionalId = z.string().uuid().nullable();
const optionalText = z.string().trim().max(2000).nullable();

/**
 * Строка предпросмотра, вернувшаяся от клиента.
 *
 * Проверяется целиком, хотя её же сервер и собрал: между предпросмотром
 * и записью лежит сеть и браузер, а доверять приходящему извне нельзя,
 * даже если оно выглядит как наше.
 */
const draftSchema = z.object({
  row: z.number().int().min(1).max(1_000_000),
  placedAt: z.string().datetime().nullable(),
  plannedDeliveryAt: z.string().datetime().nullable(),
  externalNumber: optionalText,
  totalPrice: optionalMoney,
  paidAmount: optionalMoney,
  balanceDue: optionalMoney,
  discountPercent: z.number().min(0).max(100).nullable(),
  discountComment: optionalText,
  customerSourceId: optionalId,
  deliveryStatusId: optionalId,
  shipmentOriginId: optionalId,
  paymentMethodId: optionalId,
  customerSourceText: optionalText,
  deliveryStatusText: optionalText,
  shipmentOriginText: optionalText,
  paymentMethodText: optionalText,
  customerName: optionalText,
  customerPhone: optionalText,
  deliveryTown: optionalText,
  deliveryFormattedAddress: optionalText,
  productName: optionalText,
  productNote: optionalText,
  comment: optionalText,
  sellerHint: optionalText,
  // Замечания разбора клиент возвращает как есть; на запись они не влияют,
  // поэтому содержимое не проверяем построчно.
  problems: z.array(z.object({
    column: z.string().nullable(),
    message: z.string(),
  })).max(50),
}).strict();

/** Сколько строк принимаем за один импорт. Больше — делить файл. */
const MAX_ROWS = 2000;

export const commitImportSchema = z.object({
  salesPointId: z.string().uuid(),
  sheet: z.string().trim().min(1).max(200),
  rows: z.array(draftSchema).min(1).max(MAX_ROWS),
}).strict();

export type PreviewImportInput = z.infer<typeof previewImportSchema>;
export type CommitImportInput = z.infer<typeof commitImportSchema>;
