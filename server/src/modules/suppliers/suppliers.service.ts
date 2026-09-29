import {
  AUDIT_ACTIONS,
  HISTORY_ENTITY_TYPES,
  type CommitSupplierImportResponse,
  type SupplierDiff,
  type SupplierDraft,
  type SupplierDto,
  type SupplierImportPreview,
  type SuppliersResponse,
} from '@radeya/shared';

import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../db/client';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors';
import { listSheets, readWorkbook } from '../../lib/excel';
import { diffFields, recordHistory, type HistoryEntry, type HistoryMeta } from '../../lib/history';
import { normalizeName } from '../dictionaries/dictionaries.service';
import { parseContractors } from './suppliers.parser';
import type { CommitSuppliersInput, PreviewSuppliersInput, UpdateSupplierInput } from './suppliers.schemas';

/**
 * Поставщики: справочник и импорт из выгрузки контрагентов МойСклада.
 *
 * Повторный импорт того же файла не создаёт дублей: сверка идёт по `externalId`,
 * а он в выгрузке уникален. Заполненные поля файл не перезаписывает — иначе
 * каждая новая выгрузка откатывала бы правки, сделанные руками, и понять,
 * почему адрес «сам» вернулся к старому, было бы нечем.
 */

/** Импорт десятков строк укладывается в стандартный таймаут, но с запасом надёжнее. */
const TRANSACTION_TIMEOUT_MS = 30_000;
const TRANSACTION_MAX_WAIT_MS = 10_000;

const supplierSelect = {
  id: true,
  externalId: true,
  name: true,
  address: true,
  phone: true,
  telegramId: true,
  isActive: true,
  createdAt: true,
} as const;

type SupplierRow = Prisma.SupplierGetPayload<{ select: typeof supplierSelect }>;

function toDto(row: SupplierRow): SupplierDto {
  return {
    id: row.id,
    externalId: row.externalId,
    name: row.name,
    address: row.address,
    phone: row.phone,
    telegramId: row.telegramId,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Справочник целиком.
 *
 * Без пагинации: поставщиков десятки. Закрытые тоже отдаются — на них ссылаются
 * прошлые закупки, и в фильтре за прошлый год они нужны.
 */
export async function listSuppliers(): Promise<SuppliersResponse> {
  const rows = await prisma.supplier.findMany({
    select: supplierSelect,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });

  return { items: rows.map(toDto) };
}

/**
 * Предпросмотр. **В базу не пишет** — только читает, чтобы показать,
 * что из файла новое, а что уже есть.
 */
export async function previewSupplierImport(
  file: Buffer,
  input: PreviewSuppliersInput,
): Promise<SupplierImportPreview> {
  const workbook = await readWorkbook(file);
  const sheets = listSheets(workbook);

  if (input.sheet === undefined) {
    return { sheets, sheet: null, rows: [], total: 0, filtered: 0, invalid: 0, known: 0 };
  }

  const parsed = parseContractors(workbook, input.sheet);
  const rows = await matchExisting(parsed.rows);

  return {
    sheets,
    sheet: input.sheet,
    rows,
    total: parsed.total,
    filtered: parsed.filtered,
    invalid: rows.filter((row) => !canWrite(row)).length,
    known: rows.filter((row) => row.known).length,
  };
}

/**
 * Сверка разобранных строк с базой.
 *
 * Два прохода: по `externalId` — точное совпадение, это и есть защита от дублей;
 * по нормализованному имени — подсказка на случай, когда контрагента в МойСкладе
 * завели заново и UUID у него новый. Второй случай не склеиваем автоматически:
 * одинаковое имя у двух разных поставщиков возможно, и решать это человеку.
 */
async function matchExisting(rows: SupplierDraft[]): Promise<SupplierDraft[]> {
  // Справочник берём целиком: поставщиков десятки, а сравнение по имени всё
  // равно идёт нормализованным видом, который в запрос не переложить —
  // `in` в Prisma регистр не игнорирует.
  const existing = await prisma.supplier.findMany({ select: supplierSelect });

  const byExternalId = new Map<string, SupplierRow>();
  const byName = new Map<string, SupplierRow[]>();

  for (const row of existing) {
    if (row.externalId !== null) byExternalId.set(row.externalId, row);

    const key = normalizeName(row.name);

    byName.set(key, [...(byName.get(key) ?? []), row]);
  }

  return rows.map((row) => {
    const match = row.externalId === null ? undefined : byExternalId.get(row.externalId);

    if (match) {
      return { ...row, known: true, diffs: collectDiffs(row, match) };
    }

    const sameName = row.name === null
      ? []
      : (byName.get(normalizeName(row.name)) ?? []).filter((item) => item.externalId !== row.externalId);

    if (sameName.length === 0) return row;

    return {
      ...row,
      problems: [
        ...row.problems,
        {
          column: 'Наименование',
          message: 'Поставщик с таким названием уже есть, но с другим UUID — будет заведён второй',
        },
      ],
    };
  });
}

/**
 * Чем наша запись отличается от файла.
 *
 * Только по заполненным у нас полям: пустое поле не расхождение, его импорт
 * спокойно дополнит. Расхождения показываются, но не применяются — человек
 * поправит карточку руками, если наша версия устарела.
 */
function collectDiffs(row: SupplierDraft, ours: SupplierRow): SupplierDiff[] {
  const diffs: SupplierDiff[] = [];
  const pairs: [SupplierDiff['field'], string | null, string | null][] = [
    ['name', ours.name, row.name],
    ['address', ours.address, row.address],
    ['phone', ours.phone, row.phone],
  ];

  for (const [field, mine, file] of pairs) {
    if (mine === null || file === null) continue;
    if (normalizeName(mine) === normalizeName(file)) continue;

    diffs.push({ field, ours: mine, file });
  }

  return diffs;
}

/**
 * Запись.
 *
 * Новые заводятся, существующим дозаполняются только пустые поля. `telegramId`
 * не трогаем никогда: в файле его нет, и «обновить» его можно было бы разве что
 * на пустоту.
 *
 * Всё одной транзакцией: половина импортированного справочника хуже, чем ничего.
 */
export async function commitSupplierImport(
  input: CommitSuppliersInput,
  meta: HistoryMeta,
): Promise<CommitSupplierImportResponse> {
  const failed: { row: number; message: string }[] = [];
  const writable: SupplierDraft[] = [];
  const seen = new Set<string>();

  for (const row of input.rows) {
    if (!canWrite(row)) {
      failed.push({ row: row.row, message: 'Нет наименования или UUID' });
      continue;
    }

    // Один и тот же контрагент дважды в одном файле — не ошибка выгрузки,
    // а повод не писать его дважды в одной транзакции.
    if (seen.has(row.externalId!)) {
      failed.push({ row: row.row, message: 'Этот UUID уже встречался выше в файле' });
      continue;
    }

    seen.add(row.externalId!);
    writable.push(row);
  }

  if (writable.length === 0) {
    throw new ValidationError('Ни одна строка не готова к записи');
  }

  return prisma.$transaction(async (tx) => {
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const history: HistoryEntry[] = [];
    const record = (supplierId: string, before: Record<string, unknown> | null,
      after: Record<string, unknown>) => history.push({
      type: AUDIT_ACTIONS.SUPPLIERS_IMPORTED,
      entityType: HISTORY_ENTITY_TYPES.SUPPLIER,
      entityId: supplierId,
      changes: diffFields(HISTORY_ENTITY_TYPES.SUPPLIER, before, after),
      context: { sheet: input.sheet },
    });

    for (const row of writable) {
      const existing = await tx.supplier.findUnique({
        where: { externalId: row.externalId! },
        select: { id: true, address: true, phone: true },
      });

      if (!existing) {
        const data = { name: row.name!, address: row.address, phone: row.phone };
        const { id } = await tx.supplier.create({
          data: { externalId: row.externalId, ...data },
          select: { id: true },
        });

        record(id, null, data);
        created += 1;
        continue;
      }

      // Дозаполняем только пустое. Название не трогаем вовсе: оно обязательное,
      // пустым не бывает, и «обновление» здесь означало бы затереть правку.
      const fill = {
        ...(existing.address === null && row.address !== null ? { address: row.address } : {}),
        ...(existing.phone === null && row.phone !== null ? { phone: row.phone } : {}),
      };

      if (Object.keys(fill).length === 0) {
        skipped += 1;
        continue;
      }

      await tx.supplier.update({ where: { id: existing.id }, data: fill });
      record(existing.id, existing, fill);
      updated += 1;
    }

    await recordHistory(tx, meta, history);

    return { created, updated, skipped, failed };
  }, { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS });
}

/**
 * Без наименования записывать нечего, без UUID — нечем сверять при повторе.
 *
 * Второе важнее первого: строка без UUID запишется, а через месяц тот же файл
 * заведёт её ещё раз, и найти, какая из двух настоящая, будет не по чему.
 */
function canWrite(row: SupplierDraft): boolean {
  return row.name !== null && row.externalId !== null;
}

/**
 * Правка карточки руками — прежде всего Telegram, которого в выгрузке нет.
 * «Было» читается в той же транзакции, что и запись: иначе параллельная правка
 * между чтением и записью дала бы в истории неверное «было».
 */
export async function updateSupplier(id: string, input: UpdateSupplierInput, meta: HistoryMeta) {
  try {
    return await prisma.$transaction(async (tx) => {
      const before = await tx.supplier.findUnique({ where: { id }, select: supplierSelect });

      if (!before) throw new NotFoundError('Поставщик не найден');

      const row = await tx.supplier.update({ where: { id }, data: input, select: supplierSelect });

      await recordHistory(tx, meta, [{
        type: AUDIT_ACTIONS.SUPPLIER_UPDATED,
        entityType: HISTORY_ENTITY_TYPES.SUPPLIER,
        entityId: id,
        changes: diffFields(HISTORY_ENTITY_TYPES.SUPPLIER, before, input),
      }]);

      return { before: toDto(before), after: toDto(row) };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new ConflictError('Поставщик изменился. Повторите действие');
    }

    throw error;
  }
}
