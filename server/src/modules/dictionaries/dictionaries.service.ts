import type { DictionariesResponse, DictionaryItemDto, DictionaryKind } from '@radeya/shared';

import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../db/client';
import { ConflictError, NotFoundError } from '../../lib/errors';
import type { CreateDictionaryItemInput, DictionaryListInput,
  UpdateDictionaryItemInput } from './dictionaries.schemas';

/** Повтор на случай, когда две параллельные транзакции взяли один порядок. */
const CHANGE_ATTEMPTS = 3;

/** Шаг между значениями: между ними остаётся место, чтобы вставить третье. */
const SORT_ORDER_STEP = 10;

const itemSelect = {
  id: true,
  kind: true,
  name: true,
  isActive: true,
  sortOrder: true,
  _count: {
    select: {
      customerSourceOrders: true,
      deliveryStatusOrders: true,
      shipmentOriginOrders: true,
      paymentMethodOrders: true,
    },
  },
} as const;

type ItemRow = Prisma.DictionaryItemGetPayload<{ select: typeof itemSelect }>;

/**
 * Сколько заказов висит на значении.
 *
 * Связей четыре, но у значения работает ровно одна — та, что соответствует его
 * виду. Складываем все: три слагаемых из четырёх всегда нули, а перебирать вид
 * условием значило бы повторить перечисление ещё раз.
 */
function countOrders(row: ItemRow): number {
  return row._count.customerSourceOrders
    + row._count.deliveryStatusOrders
    + row._count.shipmentOriginOrders
    + row._count.paymentMethodOrders;
}

function toDto(row: ItemRow): DictionaryItemDto {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    ordersCount: countOrders(row),
  };
}

/**
 * Значения списков.
 *
 * Без `kind` отдаются все четыре разом — в форме заказа нужны сразу все,
 * и четыре запроса вместо одного ничего не экономят: строк там несколько
 * десятков. Закрытые тоже едут: они нужны в фильтрах и в отчётах за прошлые
 * периоды, где на них ещё висят заказы.
 */
export async function listDictionaries(input: DictionaryListInput): Promise<DictionariesResponse> {
  const rows = await prisma.dictionaryItem.findMany({
    where: input.kind ? { kind: input.kind } : {},
    select: itemSelect,
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });

  return { items: rows.map(toDto) };
}

/**
 * Значения списка по названию, приведённому к нижнему регистру.
 *
 * Нужна импорту: в файле лежит текст, а в заказ нужен идентификатор. Читается
 * один раз на разбор файла — иначе на каждую из сотен строк уходило бы
 * по четыре запроса в базу.
 */
export async function loadDictionaryIndex(): Promise<Map<DictionaryKind, Map<string, string>>> {
  const rows = await prisma.dictionaryItem.findMany({
    select: { id: true, kind: true, name: true },
  });
  const index = new Map<DictionaryKind, Map<string, string>>();

  for (const row of rows) {
    let byName = index.get(row.kind);

    if (byName === undefined) {
      byName = new Map<string, string>();
      index.set(row.kind, byName);
    }

    byName.set(normalizeName(row.name), row.id);
  }

  return index;
}

/**
 * Название для сравнения.
 *
 * Регистр и лишние пробелы в рабочей таблице встречаются постоянно —
 * «Астана [Витрина Ncity]» и «астана [витрина ncity]» это одно и то же место.
 * Сравнение по этому виду одинаково работает и в импорте, и при проверке дублей.
 */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function createDictionaryItem(
  input: CreateDictionaryItemInput,
): Promise<DictionaryItemDto> {
  return changeDictionary(async (tx) => {
    await assertNameFree(tx, input.kind, input.name, null);

    const last = await tx.dictionaryItem.findFirst({
      where: { kind: input.kind },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const row = await tx.dictionaryItem.create({
      data: {
        kind: input.kind,
        name: input.name,
        sortOrder: (last?.sortOrder ?? 0) + SORT_ORDER_STEP,
      },
      select: itemSelect,
    });

    return toDto(row);
  });
}

export async function updateDictionaryItem(id: string, input: UpdateDictionaryItemInput) {
  return changeDictionary(async (tx) => {
    const before = await tx.dictionaryItem.findUnique({ where: { id }, select: itemSelect });

    if (!before) throw new NotFoundError('Значение справочника не найдено');

    if (input.name !== undefined && input.name !== before.name) {
      await assertNameFree(tx, before.kind, input.name, id);
    }

    const row = await tx.dictionaryItem.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      select: itemSelect,
    });

    return { before: toDto(before), after: toDto(row) };
  });
}

/**
 * Название занято внутри своего списка — отказываем.
 *
 * Сравнение без учёта регистра: «Наличка» и «наличка» для человека одно и то же,
 * а в отчёте две такие строки неотличимы. Закрытые значения тоже учитываются —
 * иначе новое значение смешается со старым в статистике за прошлый период.
 */
async function assertNameFree(
  tx: Prisma.TransactionClient,
  kind: DictionaryKind,
  name: string,
  exceptId: string | null,
): Promise<void> {
  const duplicate = await tx.dictionaryItem.findFirst({
    where: {
      kind,
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });

  if (duplicate) throw new ConflictError('Такое значение в этом списке уже есть');
}

/**
 * Запись в справочник под Serializable.
 *
 * Порядок вычисляется чтением максимума, и без изоляции два одновременных
 * добавления встали бы на одно место. Конфликт сериализации — не ошибка
 * пользователя, поэтому повторяем сами.
 */
async function changeDictionary<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < CHANGE_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2034' && attempt + 1 < CHANGE_ATTEMPTS) continue;
        if (error.code === 'P2002') throw new ConflictError('Такое значение в этом списке уже есть');
        if (error.code === 'P2025') throw new NotFoundError('Значение уже удалено');
        if (error.code === 'P2034') throw new ConflictError('Справочник изменился. Повторите действие');
      }

      throw error;
    }
  }

  throw new ConflictError('Повторите действие');
}
