import { Prisma } from '../../generated/prisma/client';
import { ValidationError } from '../../lib/errors';

/**
 * Деньги документа склада — только в Decimal: сумма строки и итог считаются
 * точно до тиына, number на сложении сотен строк накопил бы ошибку.
 */

/** Предел колонок `Decimal(14, 2)`: двенадцать цифр до точки. */
const MAX_AMOUNT = new Prisma.Decimal('999999999999.99');

const ZERO = new Prisma.Decimal(0);

/** Количество × цена. Слишком большая сумма — ошибка ввода, а не реальная посадка. */
export function lineAmount(price: Prisma.Decimal, quantity: number): Prisma.Decimal {
  const amount = price.mul(quantity);

  if (amount.gt(MAX_AMOUNT)) throw new ValidationError('Сумма строки слишком большая — проверьте цену и количество');

  return amount;
}

export function totalAmount(amounts: Prisma.Decimal[]): Prisma.Decimal {
  const total = amounts.reduce((sum, amount) => sum.add(amount), ZERO);

  if (total.gt(MAX_AMOUNT)) throw new ValidationError('Сумма документа слишком большая');

  return total;
}

/** Списание идёт по себестоимости; её нет — по нулю: без цены товар всё равно списывается. */
export function writeOffPrice(costPrice: Prisma.Decimal | null): Prisma.Decimal {
  return costPrice ?? ZERO;
}
