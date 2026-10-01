import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { AppError } from '../../../../../lib/errors';

/**
 * Шрифт карточки — Roboto, файлы `.woff` в `server/assets/fonts/`
 * (Apache 2.0, лежат в репозитории). Satori не понимает `.woff2` —
 * только `.woff`, `.ttf`, `.otf`.
 *
 * Отдельно латиница и кириллица: Fontsource делит шрифт по наборам символов,
 * а Satori сам берёт недостающий знак из соседнего файла того же шрифта.
 *
 * Путь от этого файла: из src/ и из dist/ до папки server одинаково шесть уровней.
 */
const FONT_DIR = path.resolve(__dirname, '../../../../../../assets/fonts');

const FONT_FILES: { weight: 400 | 700 | 900; file: string }[] = [
  { weight: 400, file: 'roboto-latin-400.woff' },
  { weight: 400, file: 'roboto-cyrillic-400.woff' },
  { weight: 700, file: 'roboto-latin-700.woff' },
  { weight: 700, file: 'roboto-cyrillic-700.woff' },
  { weight: 900, file: 'roboto-latin-900.woff' },
  { weight: 900, file: 'roboto-cyrillic-900.woff' },
];

export interface CardFont {
  name: string;
  data: Buffer;
  weight: 400 | 700 | 900;
  style: 'normal';
}

let loaded: Promise<CardFont[]> | null = null;

/** Шрифты читаются один раз на процесс. Не нашлись — понятная ошибка, а не пустая карточка. */
export function loadCardFonts(): Promise<CardFont[]> {
  loaded ??= Promise.all(FONT_FILES.map(async ({ weight, file }) => ({
    name: 'Roboto',
    data: await readFile(path.join(FONT_DIR, file)),
    weight,
    style: 'normal' as const,
  }))).catch((error: unknown) => {
    // Не кэшируем неудачу: положат файлы — следующий цикл подхватит без перезапуска.
    loaded = null;

    throw new AppError(
      500,
      'CARD_FONTS_MISSING',
      `Нет шрифтов карточки в ${FONT_DIR}: ${error instanceof Error ? error.message : 'ошибка чтения'}`,
    );
  });

  return loaded;
}
