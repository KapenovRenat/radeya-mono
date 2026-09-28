/**
 * Валюты сумм.
 *
 * Перечислением, а не строкой из файла: «руб», «RUB», «₽» и «рубли» в одном
 * поле однажды встретятся все сразу, и сумма по поставщику считаться перестанет.
 */
export const CURRENCIES = {
  KZT: 'KZT',
  RUB: 'RUB',
} as const;

export type Currency = (typeof CURRENCIES)[keyof typeof CURRENCIES];

export const CURRENCY_LABELS: Record<Currency, string> = {
  KZT: '₸',
  RUB: '₽',
};

export const CURRENCY_NAMES: Record<Currency, string> = {
  KZT: 'тенге',
  RUB: 'рубль',
};
