import { USER_ROLES, type UserRole } from './roles';

/**
 * Документы склада: оприходование и списание. Подробности — docs/inventory.md.
 *
 * Значения видов обязаны совпадать с enum `StockDocumentType` в schema.prisma.
 */
export const STOCK_DOCUMENT_TYPES = {
  ENTER: 'ENTER',
  WRITE_OFF: 'WRITE_OFF',
} as const;

export type StockDocumentType = (typeof STOCK_DOCUMENT_TYPES)[keyof typeof STOCK_DOCUMENT_TYPES];

export const STOCK_DOCUMENT_TYPE_LABELS: Record<StockDocumentType, string> = {
  ENTER: 'Оприходование',
  WRITE_OFF: 'Списание',
};

/**
 * Кто видит документы, создаёт, правит и удаляет черновики.
 *
 * Шире каталожных CATALOG_COST_ROLES намеренно: в документе видна
 * себестоимость, а в оприходовании её правят руками — решение пользователя
 * (06.10.2026). Продавец и смотрящий документов не видят.
 */
export const STOCK_DOCUMENT_ROLES: readonly UserRole[] = [USER_ROLES.ADMIN, USER_ROLES.MANAGER];

/** Кто проводит документ — меняет остатки. Сейчас только админ. */
export const STOCK_DOCUMENT_POST_ROLES: readonly UserRole[] = [USER_ROLES.ADMIN];

/** Сколько цифр в номере на экране: `00128`. Больше 99 999 — станет шестизначным. */
export const STOCK_DOCUMENT_NUMBER_DIGITS = 5;

/** Строк в одном документе. Больше — признак ошибки, а не реальной посадки. */
export const STOCK_DOCUMENT_MAX_LINES = 500;

/** Количество в строке: от 1 до этого числа. */
export const STOCK_DOCUMENT_MAX_QUANTITY = 100_000;

/**
 * Комментарий обязателен — решение пользователя: через месяц по документу
 * без пояснения не понять, откуда излишек или куда делся товар. Двадцать знаков —
 * чтобы «ревизия» и «возврат» без подробностей не проходили (решение 06.10.2026).
 */
export const STOCK_DOCUMENT_COMMENT_MIN_LENGTH = 20;
export const STOCK_DOCUMENT_COMMENT_MAX_LENGTH = 1000;

/** Цена за единицу в тенге: до 10 цифр и двух знаков после точки, как Decimal(12, 2). */
export const STOCK_DOCUMENT_PRICE_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

/** Товаров на странице окна выбора. */
export const STOCK_PICKER_PAGE_SIZE = 20;

/** `128` → `00128`. Одно правило на экран, историю товара и журнал. */
export function formatStockDocumentNumber(number: number): string {
  return String(number).padStart(STOCK_DOCUMENT_NUMBER_DIGITS, '0');
}

/**
 * Номер из адреса или поиска: `00128` и `128` — один документ.
 * Не номер — null.
 */
export function parseStockDocumentNumber(value: string): number | null {
  const trimmed = value.trim();

  if (!/^\d{1,9}$/.test(trimmed)) return null;

  const number = Number(trimmed);

  return number > 0 ? number : null;
}
