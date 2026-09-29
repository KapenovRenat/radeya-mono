import type { OrderRowDto } from "@radeya/shared";

/**
 * Как заказ показывается человеку — общее для строки реестра и окна заказа.
 * Одна функция на оба места: иначе покупатель в таблице и в окне однажды
 * склеится по-разному.
 */

/**
 * Покупатель целиком: «А Аскарбек».
 *
 * `name` у Kaspi — это только имя, фамилия приходит отдельно и обычно одной
 * буквой. Показывать одно `name` значит терять фамилию, а по ней заказы и
 * ищут глазами. Порядок «фамилия, имя» — как в кабинете и на складе.
 */
export function customerTitle(order: OrderRowDto): string | null {
  const parts = [order.customerLastName, order.customerFirstName].filter(Boolean);

  if (parts.length > 0) return parts.join(" ");

  return order.customerName;
}

/**
 * Скидка — это пара «сколько процентов» и «почему».
 *
 * Показываем обе части: `10% · Ликвидация`. Причина без процента бывает
 * («800тг» из импорта), процент без причины тоже — но когда есть обе,
 * прятать одну нельзя: процент объясняет сумму, а причина — процент.
 */
export function discountTitle(order: OrderRowDto): string | null {
  const parts: string[] = [];

  if (order.discountPercent !== null) parts.push(order.discountPercent + "%");
  if (order.discountComment !== null) parts.push(order.discountComment);

  return parts.length === 0 ? null : parts.join(" · ");
}
