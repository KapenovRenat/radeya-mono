import type { OrderRowDto } from '@radeya/shared';

import type { Prisma } from '../../generated/prisma/client';

/**
 * Строка заказа наружу — общая для списка и окна заказа.
 *
 * Одна выборка и один маппинг на оба места: окно заказа показывает всё то же,
 * что строка списка, плюс своё, и две копии однажды разошлись бы в мелочи
 * вроде того, как склеивается покупатель.
 */
export const orderRowSelect = {
  id: true, code: true, status: true, deliveryType: true, kaspiStatus: true,
  placedAt: true, plannedDeliveryAt: true, totalPrice: true,
  customerName: true, customerFirstName: true, customerLastName: true,
  customerPhone: true, deliveryTown: true, preOrder: true,
  warehouse: { select: { code: true, name: true } },
  salesPoint: { select: { id: true, name: true, type: true } },
  linkedOrder: { select: { id: true, code: true } },
  externalNumber: true, paidAmount: true, balanceDue: true,
  discountPercent: true, discountComment: true,
  // Из справочников нужно только название: идентификатор в таблице
  // не показать, а фильтруют по нему отдельным параметром.
  customerSource: { select: { name: true } },
  deliveryStatus: { select: { name: true } },
  shipmentOrigin: { select: { name: true } },
  paymentMethod: { select: { name: true } },
  // Логин и хеш пароля сюда не попадают намеренно: в таблице заказов
  // нужно имя, а не учётная запись сотрудника.
  seller: { select: { id: true, name: true, role: true } },
  _count: { select: { entries: true, comments: true } },
} as const satisfies Prisma.OrderSelect;

type OrderRowRecord = Prisma.OrderGetPayload<{ select: typeof orderRowSelect }>;

export function toOrderRow(row: OrderRowRecord): OrderRowDto {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    deliveryType: row.deliveryType,
    kaspiStatus: row.kaspiStatus,
    placedAt: row.placedAt.toISOString(),
    plannedDeliveryAt: row.plannedDeliveryAt?.toISOString() ?? null,
    // Строкой, а не числом: number на цене теряет тиын.
    totalPrice: row.totalPrice.toFixed(2),
    customerName: row.customerName,
    customerFirstName: row.customerFirstName,
    customerLastName: row.customerLastName,
    customerPhone: row.customerPhone,
    deliveryTown: row.deliveryTown,
    preOrder: row.preOrder,
    warehouse: row.warehouse,
    salesPoint: row.salesPoint,
    seller: row.seller,
    linkedOrder: row.linkedOrder,
    entriesCount: row._count.entries,
    commentsCount: row._count.comments,
    externalNumber: row.externalNumber,
    // Деньги строками, как и цена: number на сумме теряет тиын.
    paidAmount: row.paidAmount?.toFixed(2) ?? null,
    balanceDue: row.balanceDue?.toFixed(2) ?? null,
    // Процент числом: считать по нему проще, а два знака в число влезают.
    discountPercent: row.discountPercent === null ? null : Number(row.discountPercent),
    discountComment: row.discountComment,
    customerSource: row.customerSource?.name ?? null,
    deliveryStatus: row.deliveryStatus?.name ?? null,
    shipmentOrigin: row.shipmentOrigin?.name ?? null,
    paymentMethod: row.paymentMethod?.name ?? null,
  };
}
