import {
  OFFLINE_SALES_POINT_CODE_PREFIX,
  SALES_POINT_TYPES,
  SYSTEM_SALES_POINT_CODES,
  type SalesPointDto,
  type SalesPointsResponse,
} from '@radeya/shared';

import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../db/client';
import { AppError, ConflictError, NotFoundError } from '../../lib/errors';
import type { CreateSalesPointInput, UpdateSalesPointInput } from './sales-points.schemas';

/** Повтор на случай, когда две параллельные транзакции взяли один номер кода. */
const CHANGE_ATTEMPTS = 3;

/** Шаг между соседними точками: между ними остаётся место, чтобы вставить третью. */
const SORT_ORDER_STEP = 10;

const salesPointSelect = {
  id: true,
  code: true,
  name: true,
  type: true,
  isActive: true,
  sortOrder: true,
  _count: { select: { orders: true } },
} as const;

type SalesPointRow = Prisma.SalesPointGetPayload<{ select: typeof salesPointSelect }>;

function toDto(row: SalesPointRow): SalesPointDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    ordersCount: row._count.orders,
  };
}

/**
 * Справочник целиком.
 *
 * Без пагинации намеренно: точек продаж единицы, и постраничный справочник,
 * из которого собирают выпадашку, — лишняя работа и клиенту, и серверу.
 * Закрытые тоже отдаются: они нужны в фильтрах и отчётах за прошлые периоды.
 */
export async function listSalesPoints(): Promise<SalesPointsResponse> {
  const rows = await prisma.salesPoint.findMany({
    select: salesPointSelect,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
  });

  return { items: rows.map(toDto) };
}

/**
 * Идентификатор точки Kaspi — по коду, а не по типу.
 *
 * Код одинаков на любой базе, а uuid везде свой: синхронизация не может
 * держать его в конфиге. Точка приезжает сидом миграции, поэтому её отсутствие —
 * это сломанная база, а не пользовательская ошибка.
 */
export async function getKaspiSalesPointId(): Promise<string> {
  const point = await prisma.salesPoint.findUnique({
    where: { code: SYSTEM_SALES_POINT_CODES.KASPI },
    select: { id: true },
  });

  if (!point) {
    throw new AppError(
      500,
      'SALES_POINT_MISSING',
      'В справочнике нет точки продаж Kaspi. Проверьте, применена ли миграция sales_points',
    );
  }

  return point.id;
}

export async function createOfflineSalesPoint(
  input: CreateSalesPointInput,
): Promise<SalesPointDto> {
  return changeSalesPoint(async (tx) => {
    await assertNameFree(tx, input.name, null);

    const code = await nextOfflineCode(tx);
    const last = await tx.salesPoint.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const row = await tx.salesPoint.create({
      data: {
        code,
        name: input.name,
        type: SALES_POINT_TYPES.OFFLINE,
        sortOrder: (last?.sortOrder ?? 0) + SORT_ORDER_STEP,
      },
      select: salesPointSelect,
    });

    return toDto(row);
  });
}

/**
 * Переименование и закрытие.
 *
 * Системную точку переименовать можно — синхронизация ищет её по коду, а не
 * по названию, и «Kaspi магазин» вместо «Kaspi» ничего не ломает. А вот кода
 * и типа здесь нет вовсе: сменить их значит превратить точку в другую,
 * утащив за собой все её заказы.
 */
export async function updateSalesPoint(id: string, input: UpdateSalesPointInput) {
  return changeSalesPoint(async (tx) => {
    const before = await tx.salesPoint.findUnique({ where: { id }, select: salesPointSelect });

    if (!before) throw new NotFoundError('Точка продаж не найдена');

    if (input.name !== undefined && input.name !== before.name) {
      await assertNameFree(tx, input.name, id);
    }

    const row = await tx.salesPoint.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      select: salesPointSelect,
    });

    return { before: toDto(before), after: toDto(row) };
  });
}

/**
 * Следующий свободный номер офлайн-точки: `OFF-1`, `OFF-2`.
 *
 * Считается по максимуму существующих, а не по количеству строк: точка `OFF-2`
 * из справочника не исчезает, но если однажды исчезнет, счёт по количеству
 * выдал бы уже занятый код.
 */
async function nextOfflineCode(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.salesPoint.findMany({
    where: { type: SALES_POINT_TYPES.OFFLINE },
    select: { code: true },
  });

  const pattern = new RegExp('^' + OFFLINE_SALES_POINT_CODE_PREFIX + '-(\\d+)$');
  let max = 0;

  for (const row of rows) {
    const match = pattern.exec(row.code);

    if (match?.[1] === undefined) continue;

    const number = Number.parseInt(match[1], 10);

    if (Number.isSafeInteger(number) && number > max) max = number;
  }

  return OFFLINE_SALES_POINT_CODE_PREFIX + '-' + String(max + 1);
}

/**
 * Название занято — отказываем.
 *
 * Сравнение без учёта регистра: «Абая» и «абая» для человека одна и та же точка,
 * и две такие строки в отчёте неотличимы. Закрытые точки тоже учитываются:
 * иначе новая «Абая» смешается со старой в статистике за прошлый год.
 */
async function assertNameFree(
  tx: Prisma.TransactionClient,
  name: string,
  exceptId: string | null,
): Promise<void> {
  const duplicate = await tx.salesPoint.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });

  if (duplicate) throw new ConflictError('Точка продаж с таким названием уже есть');
}

/**
 * Запись в справочник под Serializable.
 *
 * Номер кода вычисляется чтением максимума, и без изоляции две одновременные
 * попытки взяли бы один `OFF-3`. Конфликт сериализации (`P2034`) — не ошибка
 * пользователя, поэтому повторяем сами.
 */
async function changeSalesPoint<T>(
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
        if (error.code === 'P2002') throw new ConflictError('Такая точка продаж уже есть');
        if (error.code === 'P2025') throw new NotFoundError('Точка продаж уже удалена');
        if (error.code === 'P2034') throw new ConflictError('Справочник изменился. Повторите действие');
      }

      throw error;
    }
  }

  throw new ConflictError('Повторите действие');
}
