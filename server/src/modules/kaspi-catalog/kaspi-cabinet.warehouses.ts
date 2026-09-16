import type { CabinetWarehouse } from '@radeya/shared';

import type { RawCabinetOffer } from './kaspi-cabinet.client';
import { readAvailabilities } from './kaspi-cabinet.mapper';

/**
 * Сводка складов за обход кабинета.
 *
 * Склад — свойство всего обхода, а не отдельного товара, поэтому собирается
 * здесь, а не в мапере: в ответ он попадает одним списком рядом со счётчиками.
 *
 * Источник — `availabilities[].storeId`. Поле `points` для справочника не
 * годится: там только коды вида `PP3`, а в справочнике ключевой ещё и
 * `kaspiStoreId`, которого в нём нет.
 *
 * Кода города (КАТО) в JSON кабинета нет ни у одного поля: `allCityPrices` —
 * это города, где показывается цена покупателю, а не города складов. Поэтому
 * `cityId` всегда пуст, и при импорте сервер понимает это как «неизвестно»,
 * а не как «сотри» — см. saveKaspiWarehouses.
 */
export function collectCabinetWarehouses(offers: RawCabinetOffer[]): CabinetWarehouse[] {
  const byCode = new Map<string, CabinetWarehouse>();

  for (const raw of offers) {
    // Один товар может лежать на складе несколькими строками наличия —
    // в счётчик товаров склад должен попасть один раз.
    const countedHere = new Set<string>();

    for (const availability of readAvailabilities(raw)) {
      const { code, storeId } = availability;

      if (code === null || storeId === null) continue;

      const current = byCode.get(code) ?? {
        code,
        storeId,
        cityId: null,
        offersCount: 0,
        totalStock: 0,
      };

      if (!countedHere.has(code)) {
        current.offersCount += 1;
        countedHere.add(code);
      }

      current.totalStock += availability.stockCount ?? 0;

      byCode.set(code, current);
    }
  }

  return [...byCode.values()].sort(byCodeNumber);
}

/**
 * По числу в коде, а не по строке: иначе `PP10` встаёт между `PP1` и `PP2`,
 * и в списке из тридцати складов нужный ищется глазами.
 */
function byCodeNumber(a: CabinetWarehouse, b: CabinetWarehouse): number {
  return warehouseNumber(a.code) - warehouseNumber(b.code);
}

function warehouseNumber(code: string): number {
  return Number(code.replace(/\D/g, '')) || 0;
}
