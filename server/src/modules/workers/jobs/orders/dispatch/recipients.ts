import { ASTANA_STOCK_WAREHOUSE_CODE } from '@radeya/shared';

import { ASTANA_GROUP_NAME } from './dispatch.constants';

/**
 * Кому слать позицию — решение пользователя 01.10.2026 (docs/workers.md):
 *
 * - в наличии со склада, у которого указана Telegram-группа, → в эту группу
 *   (сейчас это Астана — «Из наличия в Астане»);
 * - в наличии с Астаны, а группа не указана, → ждём: поставщику такой заказ не нужен;
 * - всё остальное — предзаказ откуда угодно и наличие с других складов —
 *   → поставщику товара.
 */

export type Recipient =
  | { kind: 'SUPPLIER'; supplierId: string; warehouseId: null; name: string; chatId: string }
  | { kind: 'WAREHOUSE'; supplierId: null; warehouseId: string; name: string; chatId: string };

export type RecipientResult = { recipient: Recipient } | { problem: string };

export interface RecipientOrder {
  preOrder: boolean;
  warehouse: { id: string; code: string; name: string | null; telegramChatId: string | null } | null;
}

export interface RecipientEntry {
  sku: string | null;
  variant: { supplier: { id: string; name: string; telegramId: string | null } | null } | null;
}

export function resolveRecipient(order: RecipientOrder, entry: RecipientEntry): RecipientResult {
  const warehouse = order.warehouse;

  if (!order.preOrder && warehouse !== null) {
    if (warehouse.telegramChatId) {
      return {
        recipient: {
          kind: 'WAREHOUSE',
          supplierId: null,
          warehouseId: warehouse.id,
          name: warehouse.code === ASTANA_STOCK_WAREHOUSE_CODE ? ASTANA_GROUP_NAME : warehouse.name ?? warehouse.code,
          chatId: warehouse.telegramChatId,
        },
      };
    }

    if (warehouse.code === ASTANA_STOCK_WAREHOUSE_CODE) {
      return { problem: `Не указан Telegram ID группы «${ASTANA_GROUP_NAME}» — Настройки → Получатели в Telegram` };
    }
  }

  if (entry.variant === null) {
    return { problem: `Товара с артикулом ${entry.sku ?? '(без артикула)'} нет в каталоге — поставщик неизвестен` };
  }

  const supplier = entry.variant.supplier;

  if (supplier === null) {
    return { problem: `У товара ${entry.sku ?? ''} не указан поставщик` };
  }

  if (!supplier.telegramId) {
    return { problem: `У поставщика «${supplier.name}» нет Telegram ID — Настройки → Получатели в Telegram` };
  }

  return {
    recipient: {
      kind: 'SUPPLIER', supplierId: supplier.id, warehouseId: null, name: supplier.name, chatId: supplier.telegramId,
    },
  };
}
