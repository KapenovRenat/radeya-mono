import {
  ASTANA_STOCK_WAREHOUSE_CODE,
  WAREHOUSE_TELEGRAM_GROUP_FIELDS,
  WAREHOUSE_TELEGRAM_GROUP_LABELS,
  type OrderDeliveryType,
} from '@radeya/shared';

import { ASTANA_WAREHOUSE_LABEL, DEVELOPER_RECIPIENT_NAME } from './dispatch.constants';

/**
 * Кому слать позицию — решения пользователя 01.10.2026 (docs/workers.md):
 *
 * - со склада с Telegram-группами (сейчас Астана) — и наличие, и предзаказ
 *   (решение 01.10.2026: «это всё Астана») → в группу по виду доставки:
 *   Kaspi Доставка — «Отгрузки на Zammler», своя доставка — «Своя доставка»,
 *   самовывоз — «Самовывоз»; нужная группа не указана → ждём: поставщику
 *   такой заказ не нужен. Предзаказ на карточке видно по красному фону;
 * - со складов без групп → поставщику товара, один Telegram ID на любой вид
 *   доставки: что делать, скажет карточка (Zammler, адрес клиента, самовывоз);
 * - поставщик не определён (товара нет в каталоге, у товара нет поставщика,
 *   у поставщика нет Telegram ID) → разработчику с пометкой, если его Telegram ID
 *   указан в настройках воркера; не указан — ждём, как раньше.
 */

export type Recipient =
  | { kind: 'SUPPLIER'; supplierId: string; warehouseId: null; name: string; chatId: string }
  | { kind: 'WAREHOUSE'; supplierId: null; warehouseId: string; name: string; chatId: string }
  | { kind: 'DEVELOPER'; supplierId: null; warehouseId: null; name: string; chatId: string };

export type RecipientResult =
  | {
    recipient: Recipient;
    /** Почему ушло разработчику, а не поставщику. Пусто — ушло по адресу. */
    fallbackReason: string | null;
  }
  | {
    problem: string;
    /** Кому собирались слать — для журнала: «поставщик Х», «Астана — Самовывоз». */
    intendedName: string | null;
  };

export interface RecipientWarehouse {
  id: string;
  code: string;
  name: string | null;
  kaspiDeliveryChatId: string | null;
  ownDeliveryChatId: string | null;
  pickupChatId: string | null;
}

export interface RecipientOrder {
  deliveryType: OrderDeliveryType | null;
  warehouse: RecipientWarehouse | null;
}

export interface RecipientEntry {
  sku: string | null;
  variant: { supplier: { id: string; name: string; telegramId: string | null } | null } | null;
}

export function resolveRecipient(
  order: RecipientOrder,
  entry: RecipientEntry,
  developerChatId: string | null,
): RecipientResult {
  const warehouse = order.warehouse;

  if (warehouse !== null && hasWarehouseGroups(warehouse)) {
    // У заказа Kaspi вид доставки есть всегда; пусто — сбой синхронизации, гадать не будем.
    if (order.deliveryType === null) {
      return { problem: 'У заказа не определён вид доставки — неясно, в какую группу склада', intendedName: null };
    }

    const name = warehouseGroupName(warehouse, order.deliveryType);
    const chatId = warehouse[WAREHOUSE_TELEGRAM_GROUP_FIELDS[order.deliveryType]];

    if (!chatId) {
      return { problem: `Не указан Telegram ID группы «${name}» — Настройки → Получатели в Telegram`, intendedName: name };
    }

    return {
      recipient: { kind: 'WAREHOUSE', supplierId: null, warehouseId: warehouse.id, name, chatId },
      fallbackReason: null,
    };
  }

  const supplier = entry.variant?.supplier ?? null;

  if (supplier?.telegramId) {
    return {
      recipient: {
        kind: 'SUPPLIER', supplierId: supplier.id, warehouseId: null, name: supplier.name, chatId: supplier.telegramId,
      },
      fallbackReason: null,
    };
  }

  const reason = unknownSupplierReason(entry);

  if (developerChatId) {
    return {
      recipient: { kind: 'DEVELOPER', supplierId: null, warehouseId: null, name: DEVELOPER_RECIPIENT_NAME, chatId: developerChatId },
      fallbackReason: reason,
    };
  }

  return {
    problem: `${reason}. Telegram ID разработчика не указан — переслать некому`,
    intendedName: supplier?.name ?? null,
  };
}

/** «Астана — Своя доставка»: так группа видна в журнале, подписях и тестовой рассылке. */
export function warehouseGroupName(
  warehouse: { code: string; name: string | null },
  deliveryType: OrderDeliveryType,
): string {
  const place = warehouse.code === ASTANA_STOCK_WAREHOUSE_CODE ? ASTANA_WAREHOUSE_LABEL : warehouse.name ?? warehouse.code;

  return `${place} — ${WAREHOUSE_TELEGRAM_GROUP_LABELS[deliveryType]}`;
}

/**
 * Заказы с этого склада — наличие и предзаказ — идут в его группы, а не поставщику.
 * Астана — всегда: даже пока группы не вписаны, поставщику её заказы не нужны.
 */
function hasWarehouseGroups(warehouse: RecipientWarehouse): boolean {
  return warehouse.code === ASTANA_STOCK_WAREHOUSE_CODE
    || Boolean(warehouse.kaspiDeliveryChatId || warehouse.ownDeliveryChatId || warehouse.pickupChatId);
}

/** Почему поставщик не определён — человеческим языком, для подписи и журнала. */
function unknownSupplierReason(entry: RecipientEntry): string {
  if (entry.variant === null) {
    return `Товара с артикулом ${entry.sku ?? '(без артикула)'} нет в каталоге — поставщик неизвестен`;
  }

  const supplier = entry.variant.supplier;

  if (supplier === null) return `У товара ${entry.sku ?? ''} не указан поставщик`;

  return `У поставщика «${supplier.name}» нет Telegram ID — Настройки → Получатели в Telegram`;
}
