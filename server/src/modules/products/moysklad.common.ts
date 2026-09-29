import type { ImportRowProblem } from '@radeya/shared';

import { prisma } from '../../db/client';
import { normalizeName } from '../dictionaries/dictionaries.service';

/**
 * Общее у импортов из МойСклада — выгрузки товаров и отчёта остатков.
 * Оба ищут артикул по колонке «Код» и одинаково обходятся с дублями.
 */

interface CodedRow {
  code: string | null;
  duplicate: boolean;
  problems: ImportRowProblem[];
}

/**
 * Пометка строк, чей код встречается в файле дважды.
 *
 * В проверенной выгрузке товаров таких 23 пары: картина и постер с одним кодом,
 * причём у одной строки есть цена и поставщик, у второй нули. Записать обе
 * подряд — вторая затрёт первую. Выбирать «ту, что с ценой» не будем: это правило
 * работает на сегодняшнем файле и сломается на первом же дубле с двумя ценами.
 */
export function markDuplicateCodes<T extends CodedRow>(rows: T[]): T[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    if (row.code === null) continue;

    const key = normalizeName(row.code);

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return rows.map((row) => {
    if (row.code === null || (counts.get(normalizeName(row.code)) ?? 0) < 2) return row;

    return {
      ...row,
      duplicate: true,
      problems: [
        ...row.problems,
        { column: 'Код', message: `Код «${row.code}» встречается в файле дважды — строка пропущена` },
      ],
    };
  });
}

/**
 * Артикулы каталога по нормализованному коду.
 *
 * Читаются целиком и сравниваются в памяти: `in` в Prisma регистр не игнорирует,
 * а в файле код записан как `zkz090`, у нас — как `ZKZ090`. Артикулов тысячи.
 */
export async function loadSkuIndex(): Promise<Map<string, { id: string; sku: string }>> {
  const variants = await prisma.variant.findMany({ select: { id: true, sku: true } });

  return new Map(variants.map((variant) => [normalizeName(variant.sku), variant]));
}
