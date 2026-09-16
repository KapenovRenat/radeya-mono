import type { SaveWarehousesResponse, WarehouseDto } from '@radeya/shared';

import { prisma } from '../../db/client';
import { ConflictError } from '../../lib/errors';
import type { SaveWarehousesInput } from './warehouses.schemas';
import type { Warehouse } from '../../generated/prisma/client';

/** DTO наружу — явный набор полей, а не модель целиком. */
export function toWarehouseDto(warehouse: Warehouse): WarehouseDto {
  return {
    id: warehouse.id,
    code: warehouse.code,
    kaspiStoreId: warehouse.kaspiStoreId,
    kaspiCityId: warehouse.kaspiCityId,
    name: warehouse.name,
    isActive: warehouse.isActive,
    kaspiOffersCount: warehouse.kaspiOffersCount,
    kaspiTotalStock: warehouse.kaspiTotalStock,
    kaspiStatsAt: warehouse.kaspiStatsAt?.toISOString() ?? null,
  };
}

/** Справочник складов, по коду — так их читает человек. */
export async function listWarehouses(): Promise<WarehouseDto[]> {
  const warehouses = await prisma.warehouse.findMany({ orderBy: { code: 'asc' } });

  return warehouses.map(toWarehouseDto);
}

/**
 * Импорт складов из выгрузки Kaspi.
 *
 * Операция повторяемая: сверяем по `code` и дописываем недостающее.
 * Две вещи выгрузка перезаписать не может — наше название склада и уже
 * заполненный город. Иначе повторная загрузка файла стёрла бы всё, что
 * вписали руками, а заметили бы это не сразу.
 *
 * Пропавшие из выгрузки склады не удаляем: на них ссылаются прошлые заказы,
 * и молчаливая потеря строк справочника хуже лишней строки.
 */
export async function saveKaspiWarehouses(
  input: SaveWarehousesInput,
): Promise<SaveWarehousesResponse> {
  assertUniqueCodes(input.warehouses);

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.warehouse.findMany({
        where: { code: { in: input.warehouses.map((item) => item.code) } },
      });

      const byCode = new Map(existing.map((item) => [item.code, item]));

      let created = 0;
      let updated = 0;
      let unchanged = 0;

      const statsAt = new Date();

      for (const incoming of input.warehouses) {
        const current = byCode.get(incoming.code);

        // Снимок синхронизации: сколько товаров и какой остаток был на складе.
        // Пишется всегда — это состояние на момент загрузки, а не настройка.
        const stats = {
          kaspiOffersCount: incoming.offersCount ?? null,
          kaspiTotalStock: incoming.totalStock ?? null,
          kaspiStatsAt: statsAt,
        };

        if (!current) {
          await tx.warehouse.create({
            data: {
              code: incoming.code,
              kaspiStoreId: incoming.storeId,
              kaspiCityId: incoming.cityId,
              ...stats,
            },
          });
          created += 1;
          continue;
        }

        // Пустой город в выгрузке — это «неизвестно», а не «сотри».
        const nextCityId = incoming.cityId ?? current.kaspiCityId;

        const changed =
          current.kaspiStoreId !== incoming.storeId ||
          current.kaspiCityId !== nextCityId;

        await tx.warehouse.update({
          where: { code: incoming.code },
          // name намеренно отсутствует — его заполняет человек, выгрузка не знает.
          data: { kaspiStoreId: incoming.storeId, kaspiCityId: nextCityId, ...stats },
        });

        // Обновлённый снимок изменением справочника не считаем: иначе каждая
        // синхронизация показывала бы «обновлено 4», хотя склады те же.
        if (changed) updated += 1;
        else unchanged += 1;
      }

      return { created, updated, unchanged };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(
        'storeId одного из складов уже занят другим кодом — проверьте выгрузку',
      );
    }

    throw error;
  }
}

/** Один код склада не может встретиться в запросе дважды — какой из них верный, неизвестно. */
function assertUniqueCodes(warehouses: SaveWarehousesInput['warehouses']): void {
  const seen = new Set<string>();

  for (const warehouse of warehouses) {
    if (seen.has(warehouse.code)) {
      throw new ConflictError(`Склад ${warehouse.code} встречается в списке дважды`);
    }

    seen.add(warehouse.code);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}
