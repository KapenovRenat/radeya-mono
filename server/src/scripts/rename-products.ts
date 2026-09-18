import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { argv, stdout } from 'node:process';

import { AUDIT_ACTIONS } from '@radeya/shared';

import { prisma, disconnectDatabase } from '../db/client';
import { logAction } from '../lib/audit';
import { readModelName } from '../modules/kaspi-catalog/kaspi-model-name';

/**
 * Переименование уже сохранённых товаров: в `Product.name` кладётся короткое
 * название модели («Эмбер» вместо «Кресло-кровать RADEYA Эмбер, желтый»).
 *
 * Отдельным скриптом, а не в импорте: импорт заводит только новые товары
 * и старые не трогает, а переименовать нужно разово и повторяемо — правило
 * вывода названия будет уточняться, и прогон придётся повторить.
 *
 * Запуск из корня:
 *   npm run rename:products --workspace=server                      показать
 *   npm run rename:products --workspace=server -- --apply           записать
 *   npm run rename:products --workspace=server -- --apply --force   и поверх правок руками
 *   npm run rename:products --workspace=server -- --diagnose        разбор источников
 *
 * Без `--apply` не пишет ничего: пачка на полторы тысячи записей не должна
 * уезжать в базу от одной опечатки в команде.
 *
 * `--diagnose` добавляет к отчёту разбор самих источников — где стоит бренд,
 * сколько кандидатов в `familyId`, частота каждого. Нужен, пока правило
 * уточняется; на переименование не влияет.
 *
 * Правки руками по умолчанию не затираются. «Правил человек» определяется
 * так: текущее название не совпадает ни с одним из тех, что мог поставить
 * импорт (`kaspiMasterTitle`, `kaspiTitle`, артикул). Совпадает — значит
 * никто не трогал, переименовать безопасно.
 *
 * Откат: исходное название лежит в `Variant.kaspiMasterTitle` и никуда
 * не девается. Полный список «было → стало» пишется в отчёт.
 */

const APPLY = argv.includes('--apply');
const FORCE = argv.includes('--force');
const DIAGNOSE = argv.includes('--diagnose');

/** Записи идут пачками: одна транзакция на полторы тысячи update — это надолго. */
const CHUNK_SIZE = 100;

const EXAMPLES_PER_CASE = 10;

const REPORT_PATH = resolve(__dirname, '../../rename-products.txt');

const report: string[] = [];

function out(text: string): void {
  report.push(text);
  stdout.write(text);
}

interface Plan {
  productId: string;
  sku: string;
  from: string;
  to: string;
}

/** Модификация в терминах разбора: всё, из чего правило выводит название. */
interface Source {
  sku: string;
  masterTitle: string | null;
  familyId: string | null;
  brand: string | null;
}

/**
 * Диагностика источников, а не результата.
 *
 * Отвечает на вопрос «почему промах»: есть ли название модели в `familyId`
 * вообще, где в `masterTitle` стоит бренд и какие кандидаты встречаются так
 * часто, что могут быть только типом изделия. Частотная таблица — материал
 * для словаря типов, которым правило будет уточняться.
 */
function diagnose(sources: Source[]): void {
  /** Кандидат → в скольких различных `familyId` он встретился. */
  const candidateFamilies = new Map<string, Set<string>>();
  /** Сколько нечисловых кандидатов в `familyId`: 0 — названия модели там нет вовсе. */
  const candidateCounts = new Map<number, number>();
  /** Где в `masterTitle` стоит бренд: до него столько-то слов. */
  const brandPositions = new Map<string, number>();

  const bump = (map: Map<string, number>, key: string) =>
    map.set(key, (map.get(key) ?? 0) + 1);

  for (const source of sources) {
    const result = readModelName(source.familyId, source.masterTitle, source.brand);

    candidateCounts.set(
      result.candidates.length,
      (candidateCounts.get(result.candidates.length) ?? 0) + 1,
    );

    if (source.familyId) {
      for (const candidate of result.candidates) {
        const families = candidateFamilies.get(candidate) ?? new Set<string>();
        families.add(source.familyId);
        candidateFamilies.set(candidate, families);
      }
    }

    if (!source.masterTitle) bump(brandPositions, 'нет masterTitle');
    else if (!source.brand) bump(brandPositions, 'нет бренда');
    else {
      const at = source.masterTitle.toLowerCase().indexOf(source.brand.toLowerCase());
      if (at === -1) bump(brandPositions, 'бренда нет в названии');
      else if (at === 0) bump(brandPositions, 'бренд первым словом');
      else {
        const words = source.masterTitle.slice(0, at).trim().split(/\s+/).length;
        bump(brandPositions, `перед брендом слов: ${words}`);
      }
    }
  }

  out('--- Сколько нечисловых кандидатов в familyId ---\n');
  for (const [count, items] of [...candidateCounts].sort((a, b) => a[0] - b[0])) {
    const note = count === 0 ? '  ← названия модели в familyId нет вовсе' : '';
    out(`  ${count} кандидат(ов): ${items} артикулов${note}\n`);
  }
  out('\n');

  out('--- Где в masterTitle стоит бренд ---\n');
  for (const [where, count] of [...brandPositions].sort((a, b) => b[1] - a[1])) {
    out(`  ${where}: ${count}\n`);
  }
  out('\n');

  out('--- Все кандидаты familyId по частоте ---\n');
  out('  Встречается во многих familyId — это тип, форма или ткань, не модель.\n');
  out('  По этому списку собирается словарь: всё частое в него, редкое — названия.\n');
  const frequent = [...candidateFamilies]
    .map(([candidate, families]) => [candidate, families.size] as const)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'));
  for (const [candidate, families] of frequent) {
    out(`  ${String(families).padStart(4)} familyId × «${candidate}»\n`);
  }
  out(`\nВсего различных кандидатов: ${candidateFamilies.size}\n\n`);
}

type SkipReason = 'NO_NAME' | 'SAME_NAME' | 'EDITED_BY_HAND' | 'VARIANTS_DISAGREE';

const SKIP_LABELS: Record<SkipReason, string> = {
  NO_NAME: 'правило не смогло выделить название — остаётся как было',
  SAME_NAME: 'название уже правильное — менять нечего',
  EDITED_BY_HAND: 'название правил человек — не затираем (перебить: --force)',
  VARIANTS_DISAGREE: 'модификации дали разные названия — разбирать руками',
};

function short(value: string | null, limit = 60): string {
  if (value === null) return '—';
  return value.length <= limit ? value : value.slice(0, limit - 1) + '…';
}

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true, name: true, brand: true, kaspiFamilyId: true,
      variants: { select: { sku: true, kaspiMasterTitle: true, kaspiTitle: true },
        orderBy: { sku: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  });

  out('\n=== Переименование товаров ===\n\n');
  out(APPLY ? 'Режим: ЗАПИСЬ В БАЗУ' : 'Режим: только показ, база не меняется');
  out(FORCE ? ', правки руками затираются\n\n' : '\n\n');

  if (products.length === 0) {
    out('В каталоге нет товаров — сначала импорт.\n');
    return;
  }

  const plans: Plan[] = [];
  const skipped = new Map<SkipReason, Plan[]>();
  const sources: Source[] = [];

  const skip = (reason: SkipReason, plan: Plan) => {
    const list = skipped.get(reason);
    if (list) list.push(plan);
    else skipped.set(reason, [plan]);
  };

  for (const product of products) {
    const sku = product.variants[0]?.sku ?? '—';
    const plan = (to: string): Plan => ({ productId: product.id, sku, from: product.name, to });

    // Из Kaspi на артикул создаётся свой товар, но объединённые руками товары
    // с несколькими модификациями уже возможны. Тогда название должно сойтись
    // у всех: расхождение — повод посмотреть глазами, а не выбрать первое.
    const names = new Set<string>();
    for (const variant of product.variants) {
      const result = readModelName(product.kaspiFamilyId, variant.kaspiMasterTitle, product.brand);
      if (result.name !== null) names.add(result.name);

      if (DIAGNOSE) {
        sources.push({ sku: variant.sku, masterTitle: variant.kaspiMasterTitle,
          familyId: product.kaspiFamilyId, brand: product.brand });
      }
    }

    if (names.size === 0) {
      skip('NO_NAME', plan(product.name));
      continue;
    }

    if (names.size > 1) {
      skip('VARIANTS_DISAGREE', plan([...names].join(' | ')));
      continue;
    }

    const [name] = [...names];
    if (name === undefined || name === product.name) {
      skip('SAME_NAME', plan(product.name));
      continue;
    }

    // Что мог поставить импорт: masterTitle, наше название из кабинета, артикул.
    const fromImport = product.variants.flatMap((variant) =>
      [variant.kaspiMasterTitle, variant.kaspiTitle, variant.sku].filter(
        (value): value is string => value !== null,
      ),
    );

    if (!FORCE && !fromImport.includes(product.name)) {
      skip('EDITED_BY_HAND', plan(name));
      continue;
    }

    plans.push(plan(name));
  }

  out(`Товаров в каталоге:  ${products.length}\n`);
  out(`К переименованию:    ${plans.length}\n`);
  out(`Пропущено:           ${products.length - plans.length}\n\n`);

  for (const [reason, list] of [...skipped].sort((a, b) => b[1].length - a[1].length)) {
    out(`  ${reason} — ${list.length} шт. ${SKIP_LABELS[reason]}\n`);
    if (reason === 'SAME_NAME') continue;
    for (const item of list.slice(0, EXAMPLES_PER_CASE)) {
      out(`      ${item.sku.padEnd(12)} ${short(item.from)}\n`);
    }
    if (list.length > EXAMPLES_PER_CASE) out(`      ... ещё ${list.length - EXAMPLES_PER_CASE}\n`);
  }
  out('\n');

  if (DIAGNOSE) diagnose(sources);

  if (plans.length === 0) {
    out('Менять нечего.\n');
    return;
  }

  out('--- Полный список «было → стало» ---\n');
  for (const item of plans) {
    out(`  ${item.sku.padEnd(12)} «${item.to}»\n      было: ${short(item.from, 90)}\n`);
  }
  out('\n');

  if (!APPLY) {
    out('Это был показ. Записать в базу: добавьте --apply к команде.\n');
    return;
  }

  let done = 0;
  for (let from = 0; from < plans.length; from += CHUNK_SIZE) {
    const chunk = plans.slice(from, from + CHUNK_SIZE);
    // Пачка целиком или никак: половина переименованных товаров хуже,
    // чем ни один — по отчёту не понять, где остановились.
    await prisma.$transaction(
      chunk.map((item) =>
        prisma.product.update({ where: { id: item.productId }, data: { name: item.to } }),
      ),
    );
    done += chunk.length;
    stdout.write(`  записано ${done} из ${plans.length}\n`);
  }

  out(`\nПереименовано: ${done}\n`);

  await logAction({
    userLogin: 'script:rename-products',
    userRole: 'SYSTEM',
    action: AUDIT_ACTIONS.PRODUCTS_RENAMED,
    entityType: 'Product',
    after: {
      renamed: done,
      skipped: products.length - plans.length,
      force: FORCE,
      // Список целиком в журнал не кладём: он в отчёте, а журнал не архив.
      examples: plans.slice(0, EXAMPLES_PER_CASE).map((item) => ({ sku: item.sku, to: item.to })),
    },
  });

  out('Откат: исходные названия лежат в Variant.kaspiMasterTitle.\n');
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    out(`\nОшибка: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    writeFileSync(REPORT_PATH, report.join(''), 'utf8');
    stdout.write(`\nОтчёт: ${REPORT_PATH}\n`);
    await disconnectDatabase();
  });
