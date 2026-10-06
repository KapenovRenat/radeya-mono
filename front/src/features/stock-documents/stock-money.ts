import { STOCK_DOCUMENT_PRICE_PATTERN } from "@radeya/shared";

/**
 * Суммы черновика на экране — в целых тиын: 0.1 + 0.2 в number даёт
 * 0.30000000000000004, а на сотне строк такая ошибка уже видна в итоге.
 * Итог, который ляжет в базу, всё равно считает сервер — здесь только показ.
 */

/** `"120000.5"` → 12000050. Не цена — null. */
export function priceToTiyn(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");

  if (!STOCK_DOCUMENT_PRICE_PATTERN.test(trimmed)) return null;

  const [whole, fraction = ""] = trimmed.split(".");

  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** Цена для поля ввода: запятую человек ставит по привычке, сервер ждёт точку. */
export function normalizePrice(value: string): string {
  return value.trim().replace(",", ".");
}

export function tiynToTenge(tiyn: number): number {
  return tiyn / 100;
}
