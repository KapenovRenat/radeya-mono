"use client";

import { DICTIONARY_KINDS, type DictionaryItemDto, type DictionaryKind } from "@radeya/shared";

import { Dropdown, type DropdownOption } from "@/components/dropdown";
import { useGetDictionariesQuery } from "@/features/dictionaries/dictionaries-api";
import type { DictionaryFilterField } from "@/features/orders/use-orders-list";

/**
 * Фильтры по пополняемым спискам офлайн-точки.
 *
 * Четыре одинаковых выпадашки описаны списком, а не четырьмя кусками разметки:
 * они отличаются только подписью и полем запроса, и копии однажды разъехались бы
 * в мелочи вроде размера или порядка значений.
 *
 * Выпадашка — общий `Dropdown`, а не нативный `<select>`: в справочнике
 * «Откуда поехал товар» уже десяток значений и будет больше, а листать их
 * без поиска невозможно. Заодно закрытые значения показываются пометкой,
 * чего в `<option>` не сделать.
 */
const FILTERS: { kind: DictionaryKind; field: DictionaryFilterField; label: string }[] = [
  { kind: DICTIONARY_KINDS.DELIVERY_STATUS, field: "deliveryStatusId", label: "Статус доставки" },
  { kind: DICTIONARY_KINDS.PAYMENT_METHOD, field: "paymentMethodId", label: "Оплата" },
  { kind: DICTIONARY_KINDS.SHIPMENT_ORIGIN, field: "shipmentOriginId", label: "Откуда товар" },
  { kind: DICTIONARY_KINDS.CUSTOMER_SOURCE, field: "customerSourceId", label: "Откуда клиент" },
];

/** Пустое значение — «все», а не «ни одного». */
const ALL_OPTION: DropdownOption = { value: "", label: "Все" };

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

  const toOptions = (kind: DictionaryKind): DropdownOption[] => [
    // Сняв фильтр, человек ждёт полный реестр, а не пустую таблицу.
    ALL_OPTION,
    ...items
      .filter((item: DictionaryItemDto) => item.kind === kind)
      .map((item) => ({
        value: item.id,
        label: item.name,
        // Закрытое значение из списка не убираем: по нему смотрят заказы
        // за прошлые периоды, где оно ещё проставлено. Пометка отдельным
        // полем, а не в названии, — иначе поиск по «закрыто» найдёт полсписка.
        ...(item.isActive ? {} : { note: "закрыто" }),
      })),
  ];

  return (
    <div className="flex flex-wrap items-end gap-3">
      {FILTERS.map((filter) => {
        const options = toOptions(filter.kind);

        return (
          <div key={filter.field} className="min-w-52 space-y-1">
            {/* Не <label>: внутри кнопка, а клик по подписи открывал бы список
                вторым нажатием и тут же его закрывал. Связь — через aria-label
                кнопки, её задаёт проп label. */}
            <span className="block text-sm">{filter.label}</span>

            <Dropdown
              mode="select"
              searchable
              searchPlaceholder={`Поиск: ${filter.label.toLowerCase()}`}
              label={filter.label}
              placeholder="Все"
              options={options}
              value={value(filter.field)}
              onChange={(next) => onChange(filter.field, next)}
              // Один вариант «Все» означает, что справочник пуст: выбирать нечего.
              disabled={disabled || options.length <= 1}
            />
          </div>
        );
      })}
    </div>
  );
}
