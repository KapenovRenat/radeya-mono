import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { AppError } from '../../../../../lib/errors';

/**
 * Шрифт карточки — Roboto, файлы `.woff` в `server/assets/fonts/`
 * (Apache 2.0, лежат в репозитории). Satori не понимает `.woff2` —
 * только `.woff`, `.ttf`, `.otf`.
 *
 * Отдельно латиница и кириллица: Fontsource делит шрифт по наборам символов.
 * **У кириллицы своё имя** — `Roboto Cyrillic`. Из файлов с одним именем
 * и жирностью Satori берёт только первый, и кириллица выходила квадратами.
 * С разными именами он берёт недостающий знак из другого шрифта сам.
 *
 * Путь от этого файла: из src/ и из dist/ до папки server одинаково шесть уровней.
 */
const FONT_DIR = path.resolve(__dirname, '../../../../../../assets/fonts');

/** Основной шрифт карточки — латиница и цифры; кириллица подставляется из своего. */
export const CARD_FONT_FAMILY = 'Roboto';
const CYRILLIC_FONT_FAMILY = 'Roboto Cyrillic';

const FONT_FILES: { name: string; weight: 400 | 700 | 900; file: string }[] = [
  { name: CARD_FONT_FAMILY, weight: 400, file: 'roboto-latin-400.woff' },
  { name: CARD_FONT_FAMILY, weight: 700, file: 'roboto-latin-700.woff' },
  { name: CARD_FONT_FAMILY, weight: 900, file: 'roboto-latin-900.woff' },
  { name: CYRILLIC_FONT_FAMILY, weight: 400, file: 'roboto-cyrillic-400.woff' },
  { name: CYRILLIC_FONT_FAMILY, weight: 700, file: 'roboto-cyrillic-700.woff' },
  { name: CYRILLIC_FONT_FAMILY, weight: 900, file: 'roboto-cyrillic-900.woff' },
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
  loaded ??= Promise.all(FONT_FILES.map(async ({ name, weight, file }) => ({
    name,
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
