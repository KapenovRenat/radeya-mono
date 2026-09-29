import {
  CATALOG_NO_SUPPLIER,
  CATALOG_SORT_KEYS,
  SALES_CHANNELS,
  SORT_ORDERS,
  type CatalogSortKey,
  type SortOrder,
} from '@radeya/shared';

import { Prisma } from '../../generated/prisma/client';
import type { CatalogInput } from './catalog.schemas';

/**
 * Порядок и страница каталога — одним параметризованным SQL.
 *
 * Почему не Prisma `findMany`: сортировки по сумме остатков по складам и по цене
 * из связанной таблицы Prisma не умеет — `orderBy` по связи «один ко многим»
 * даёт только `_count`. Поэтому SQL выдаёт id строк страницы в нужном порядке,
 * а сами строки потом берёт обычная выборка Prisma с тем же DTO.
 *
 * Поиск, папка и фильтры живут здесь же, а не в двух местах: список в каталоге
 * один, и второй способ его отбора однажды разошёлся бы с первым.
 *
 * Безопасность: все значения — параметры (`${…}` в Prisma.sql). Имя колонки
 * и направление берутся из закрытых словарей ниже по ключу, прошедшему
 * валидацию, — текст запроса в SQL не попадает никогда.
 */

/** Цифры склада на артикул: сумма по складам (при фильтре — только по выбранным). */
const SORT_SQL: Record<CatalogSortKey, Prisma.Sql> = {
  // Текущая цена Kaspi: со скидкой, если она есть, — ту и видит покупатель.
  [CATALOG_SORT_KEYS.PRICE]: Prisma.sql`COALESCE(l."discountPrice", l."price")`,
  [CATALOG_SORT_KEYS.PURCHASE_PRICE]: Prisma.sql`v."purchasePrice"`,
  [CATALOG_SORT_KEYS.QUANTITY]: Prisma.sql`s."quantity"`,
  [CATALOG_SORT_KEYS.RESERVED]: Prisma.sql`s."reserved"`,
  [CATALOG_SORT_KEYS.EXPECTED]: Prisma.sql`s."expected"`,
  // Не указано ничего — «неизвестно», а не ноль: такие строки уходят в конец.
  [CATALOG_SORT_KEYS.AVAILABLE]: Prisma.sql`CASE
    WHEN s."quantity" IS NULL AND s."reserved" IS NULL AND s."expected" IS NULL THEN NULL
    ELSE COALESCE(s."quantity", 0) - COALESCE(s."reserved", 0) + COALESCE(s."expected", 0) END`,
  [CATALOG_SORT_KEYS.PRE_ORDER_DAYS]: Prisma.sql`s."preOrderDays"`,
  [CATALOG_SORT_KEYS.DAYS_ON_STOCK]: Prisma.sql`(EXTRACT(EPOCH FROM now()) - s."receivedEpoch")`,
};

const ORDER_SQL: Record<SortOrder, Prisma.Sql> = {
  [SORT_ORDERS.ASC]: Prisma.sql`ASC`,
  [SORT_ORDERS.DESC]: Prisma.sql`DESC`,
};

/**
 * Порядок по умолчанию и добивка после сортировки: сначала то, что продаётся
 * (ON_SALE объявлен в enum раньше OFF_SALE, Postgres сортирует enum по порядку
 * объявления), дальше по алфавиту. `sku` последним обязателен: без него порядок
 * одинаковых строк между страницами не определён.
 */
const TIE_BREAK_SQL = Prisma.sql`v."status" ASC, p."name" ASC, v."sku" ASC`;

export interface CatalogPageIds {
  ids: string[];
  total: number;
  page: number;
}

/** Страница id в порядке показа. `tx` — транзакция: счётчик и страница из одного снимка. */
export async function selectCatalogPage(
  tx: Prisma.TransactionClient,
  input: CatalogInput,
  category: { id: string; path: string } | null,
): Promise<CatalogPageIds> {
  const where = buildWhere(input, category);
  const stockFilter = input.warehouseIds.length > 0
    ? Prisma.sql`WHERE vs."warehouseId" = ANY(${input.warehouseIds}::uuid[])`
    : Prisma.empty;

  const [counted] = await tx.$queryRaw<{ total: bigint }[]>(Prisma.sql`
    SELECT COUNT(*) AS total
    FROM "Variant" v
    JOIN "Product" p ON p."id" = v."productId"
    LEFT JOIN "Category" c ON c."id" = p."categoryId"
    ${where}`);

  // COUNT без GROUP BY строку возвращает всегда; запас — для строгой проверки индексов.
  const count = Number(counted?.total ?? 0);
  const totalPages = Math.ceil(count / input.pageSize);
  // После переноса последней строки из папки возвращаем последнюю непустую страницу.
  const page = Math.min(input.page, Math.max(1, totalPages));

  // Пустые значения — в конце в обе стороны: при сортировке «по возрастанию»
  // первыми иначе стояли бы товары без цены и без склада.
  const orderBy = input.sort === undefined
    ? TIE_BREAK_SQL
    : Prisma.sql`${SORT_SQL[input.sort]} ${ORDER_SQL[input.order]} NULLS LAST, ${TIE_BREAK_SQL}`;

  const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    WITH s AS (
      SELECT vs."variantId",
        SUM(vs."quantity") AS "quantity",
        SUM(vs."reserved") AS "reserved",
        SUM(vs."expected") AS "expected",
        MAX(vs."preOrderDays") AS "preOrderDays",
        -- Средняя дата поступления, взвешенная по остатку: как «Дней на складе»
        -- у МойСклада. Пустой склад и склад без даты в среднее не входят.
        SUM(vs."quantity" * EXTRACT(EPOCH FROM vs."receivedAt"))
          FILTER (WHERE vs."quantity" > 0 AND vs."receivedAt" IS NOT NULL)
          / NULLIF(SUM(vs."quantity")
            FILTER (WHERE vs."quantity" > 0 AND vs."receivedAt" IS NOT NULL), 0) AS "receivedEpoch"
      FROM "VariantStock" vs
      ${stockFilter}
      GROUP BY vs."variantId"
    )
    SELECT v."id"
    FROM "Variant" v
    JOIN "Product" p ON p."id" = v."productId"
    LEFT JOIN "Category" c ON c."id" = p."categoryId"
    LEFT JOIN s ON s."variantId" = v."id"
    LEFT JOIN "Listing" l ON l."variantId" = v."id"
      AND l."channel" = CAST(${SALES_CHANNELS.KASPI} AS "SalesChannel")
    ${where}
    ORDER BY ${orderBy}
    LIMIT ${input.pageSize}::int OFFSET ${(page - 1) * input.pageSize}::int`);

  return { ids: rows.map((row) => row.id), total: count, page };
}

function buildWhere(input: CatalogInput, category: { id: string; path: string } | null): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  if (category !== null) {
    // Папка вместе с подпапками: `path` потомков начинается с пути папки и её id.
    conditions.push(Prisma.sql`(c."id" = ${category.id}::uuid
      OR starts_with(c."path", ${category.path + category.id + '/'}))`);
  }

  if (input.search !== '') {
    // ILIKE: пользовательские % и _ должны остаться символами, а не шаблоном.
    const pattern = '%' + input.search.replace(/[\\%_]/g, (char) => '\\' + char) + '%';

    conditions.push(Prisma.sql`(v."sku" ILIKE ${pattern} OR p."name" ILIKE ${pattern}
      OR v."kaspiMasterTitle" ILIKE ${pattern} OR v."kaspiTitle" ILIKE ${pattern})`);
  }

  if (input.warehouseIds.length > 0) {
    // «Назначен на склад» — есть строка склада, даже с нулевым остатком.
    conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "VariantStock" f
      WHERE f."variantId" = v."id" AND f."warehouseId" = ANY(${input.warehouseIds}::uuid[]))`);
  }

  if (input.supplierIds.length > 0) {
    const ids = input.supplierIds.filter((id) => id !== CATALOG_NO_SUPPLIER);
    const withoutSupplier = input.supplierIds.includes(CATALOG_NO_SUPPLIER);
    const parts: Prisma.Sql[] = [];

    if (ids.length > 0) parts.push(Prisma.sql`v."supplierId" = ANY(${ids}::uuid[])`);
    if (withoutSupplier) parts.push(Prisma.sql`v."supplierId" IS NULL`);

    conditions.push(Prisma.sql`(${Prisma.join(parts, ' OR ')})`);
  }

  return conditions.length === 0
    ? Prisma.empty
    : Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}
