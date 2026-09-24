"use client";

import { DICTIONARY_KINDS, type DictionaryItemDto, type DictionaryKind } from "@radeya/shared";

import { useGetDictionariesQuery } from "@/features/dictionaries/dictionaries-api";
import type { DictionaryFilterField } from "@/features/orders/use-orders-list";

/**
 * Фильтры по пополняемым спискам офлайн-точки.
 *
 * Четыре одинаковых выпадашки описаны списком, а не четырьмя кусками разметки:
 * они отличаются только подписью и полем запроса, и копии однажды разъехались бы
 * в мелочи вроде размера или порядка значений.
 */
const FILTERS: { kind: DictionaryKind; field: DictionaryFilterField; label: string }[] = [
  { kind: DICTIONARY_KINDS.DELIVERY_STATUS, field: "deliveryStatusId", label: "Статус доставки" },
  { kind: DICTIONARY_KINDS.PAYMENT_METHOD, field: "paymentMethodId", label: "Оплата" },
  { kind: DICTIONARY_KINDS.SHIPMENT_ORIGIN, field: "shipmentOriginId", label: "Откуда товар" },
  { kind: DICTIONARY_KINDS.CUSTOMER_SOURCE, field: "customerSourceId", label: "Откуда клиент" },
];

interface OrderDictionaryFiltersProps {
  value: (field: DictionaryFilterField) => string;
  onChange: (field: DictionaryFilterField, id: string) => void;
  disabled?: boolean;
}

export function OrderDictionaryFilters({
  value,
  onChange,
  disabled,
}: OrderDictionaryFiltersProps) {
  // Все четыре списка одним запросом: в них несколько десятков строк,
  // и четыре запроса вместо одного ничего не экономят.
  const dictionaries = useGetDictionariesQuery();
  const items = dictionaries.data?.items ?? [];

  const byKind = (kind: DictionaryKind): DictionaryItemDto[] =>
    items.filter((item) => item.kind === kind);

  return (
    <div className="flex flex-wrap items-end gap-3">
      {FILTERS.map((filter) => {
        const options = byKind(filter.kind);

        return (
          <label key={filter.field} className="min-w-52 space-y-1">
            <span className="text-sm">{filter.label}</span>

            <select
              value={value(filter.field)}
              disabled={disabled || options.length === 0}
              onChange={(event) => onChange(filter.field, event.target.value)}
              className="h-[42px] w-full rounded-md border border-border bg-background px-3"
            >
              {/* Пусто — «все», а не «ни одного»: сняв фильтр, человек ждёт
                  полный реестр, а не пустую таблицу. */}
              <option value="">Все</option>

              {options.map((item) => (
                <option key={item.id} value={item.id}>
                  {/* Закрытое значение из списка не убираем: по нему смотрят
                      заказы за прошлые периоды, где оно ещё проставлено. */}
                  {item.name}{item.isActive ? "" : " (закрыто)"}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}
