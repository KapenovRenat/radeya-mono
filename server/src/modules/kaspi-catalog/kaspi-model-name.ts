/**
 * Название модели изделия из данных кабинета: «Эмбер», «Веста», «Рони».
 *
 * По позиции скобки в `familyId` брать нельзя — проверено и опровергнуто
 * (docs/kaspi-api-integration.md, раздел 11):
 *
 *   диван:   {Веста}{мини-диван}{прямой}{155}          модель первая
 *   кровать: {Детская кровать}{Рони}{90}               модель вторая
 *   кресло:  {кресло-кровать}{рогожка}{70}{90}{Эмбер}  модель последняя
 *
 * Поэтому источников два, и они сверяются друг с другом. `familyId` даёт список
 * кандидатов, `masterTitle` — порядок слов витрины:
 *
 *   familyId:    ...{кресло-кровать}{рогожка}{70}{90}{Эмбер}
 *   masterTitle: Кресло-кровать RADEYA Эмбер, желтый
 *                               ^бренд ^дальше модель
 *
 * Тип изделия стоит в названии до бренда, поэтому в поиск не попадает вовсе —
 * ищем только в хвосте после бренда. Совпало — название наше, не совпало —
 * возвращаем null с причиной: подставлять догадку в поле, которое поедет
 * на витрину, нельзя. Поле правится руками, и пустое лучше неверного.
 */

/** Почему название не удалось выделить. Нужна и для пометки, и для отчётов. */
export type ModelNameFailure =
  | 'NO_FAMILY_ID'
  | 'NO_CANDIDATES'
  | 'NO_MASTER_TITLE'
  | 'BRAND_NOT_IN_TITLE'
  | 'NO_MATCH';

/** Каким путём получено название — чтобы видеть долю ненадёжного пути. */
export type ModelNameSource = 'TITLE_AFTER_BRAND' | 'SINGLE_CANDIDATE';

export interface ModelNameResult {
  name: string | null;
  source: ModelNameSource | null;
  failure: ModelNameFailure | null;
  /** Непустые нечисловые скобки `familyId` — их видно в отчёте разбора. */
  candidates: string[];
}

export const MODEL_NAME_FAILURE_LABELS: Record<ModelNameFailure, string> = {
  NO_FAMILY_ID: 'familyId пустой — кандидатов нет вовсе',
  NO_CANDIDATES: 'в familyId только числа или пустые скобки',
  NO_MASTER_TITLE: 'нет masterTitle — сверять кандидатов не с чем',
  BRAND_NOT_IN_TITLE: 'бренд не найден в masterTitle — где начинается модель, неизвестно',
  NO_MATCH: 'ни один кандидат не встретился в masterTitle после бренда',
};

/**
 * Приведение к сравнимому виду **без изменения длины строки**: индексы
 * совпадают с исходной, и найденное можно вырезать из неё с её написанием.
 * Поэтому пробелы не сворачиваются: двойной пробел в названии даст промах
 * и пометку, а не молча съеденный символ.
 */
function normalize(value: string): string {
  return value.toLowerCase().replace(/ё/g, 'е');
}

function isWordChar(char: string | undefined): boolean {
  // \b в JS считает словом только латиницу и цифры, кириллица ему не слово.
  return char !== undefined && /[\p{L}\p{N}]/u.test(char);
}

/** Вхождение по границам слов: «Веста» не должна находиться внутри «Вестакрафт». */
function indexOfWord(haystack: string, needle: string): number {
  if (!needle) return -1;

  for (let from = 0; from <= haystack.length - needle.length; ) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return -1;

    const before = at === 0 ? undefined : haystack[at - 1];
    const after = haystack[at + needle.length];

    if (!isWordChar(before) && !isWordChar(after)) return at;

    from = at + 1;
  }

  return -1;
}

/** Содержимое фигурных скобок: `{Эмбер}` → `Эмбер`. Квадратные — код категории и бренда. */
function readCandidates(familyId: string, brand: string | null): string[] {
  const parts = [...familyId.matchAll(/\{([^}]*)\}/g)].map((match) => (match[1] ?? '').trim());
  const normalizedBrand = brand === null ? null : normalize(brand);

  return parts.filter((part) => {
    if (part === '') return false;
    // Числовая скобка — это размер, вес или объём. Дробные тоже: в данных
    // встречаются {23.50} и {22.30}, целочисленный фильтр их пропускал.
    if (/^\d+([.,]\d+)?$/.test(part)) return false;
    // В скобках попадаются флаги как есть: {true}, {false}.
    if (part === 'true' || part === 'false') return false;
    return normalizedBrand === null || normalize(part) !== normalizedBrand;
  });
}

export function readModelName(
  familyId: string | null,
  masterTitle: string | null,
  brand: string | null,
): ModelNameResult {
  if (!familyId) {
    return { name: null, source: null, failure: 'NO_FAMILY_ID', candidates: [] };
  }

  const candidates = readCandidates(familyId, brand);
  const fail = (failure: ModelNameFailure): ModelNameResult => ({
    name: null, source: null, failure, candidates,
  });

  if (candidates.length === 0) return fail('NO_CANDIDATES');

  // Единственный кандидат — выбора нет: это либо модель, либо тип изделия,
  // и разобрать их без названия витрины нечем. Путь помечается источником,
  // чтобы его долю было видно в отчёте, а не считалась надёжной.
  const single = (): ModelNameResult =>
    candidates.length === 1 && candidates[0] !== undefined
      ? { name: candidates[0], source: 'SINGLE_CANDIDATE', failure: null, candidates }
      : fail(masterTitle ? 'BRAND_NOT_IN_TITLE' : 'NO_MASTER_TITLE');

  if (!masterTitle) return single();

  const haystack = normalize(masterTitle);
  const normalizedBrand = brand ? normalize(brand) : null;
  const brandAt = normalizedBrand ? indexOfWord(haystack, normalizedBrand) : -1;
  if (brandAt === -1 || normalizedBrand === null) return single();

  const tailFrom = brandAt + normalizedBrand.length;
  const tail = haystack.slice(tailFrom);

  // Побеждает самый ранний кандидат: сразу за брендом стоит модель, дальше —
  // цвет и обивка. При равном начале берём длинный, иначе «Монза 350»
  // обрежется до «Монза».
  let bestAt = -1;
  let bestLength = 0;

  for (const candidate of candidates) {
    const at = indexOfWord(tail, normalize(candidate));
    if (at === -1) continue;

    if (bestAt === -1 || at < bestAt || (at === bestAt && candidate.length > bestLength)) {
      bestAt = at;
      bestLength = candidate.length;
    }
  }

  if (bestAt === -1) return fail('NO_MATCH');

  // Написание берём из masterTitle: это то, как модель названа на витрине.
  return {
    name: masterTitle.slice(tailFrom + bestAt, tailFrom + bestAt + bestLength).trim(),
    source: 'TITLE_AFTER_BRAND',
    failure: null,
    candidates,
  };
}
