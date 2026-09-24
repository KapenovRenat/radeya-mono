import type { DictionaryKind } from '../constants/dictionaries';

/** Значение пополняемого списка. */
export interface DictionaryItemDto {
  id: string;
  kind: DictionaryKind;
  name: string;
  /** Закрытое значение не предлагается при вводе, но остаётся в фильтрах. */
  isActive: boolean;
  sortOrder: number;
  /** Сколько заказов на нём висит. Объясняет, почему значение не удалить. */
  ordersCount: number;
}

/**
 * Справочники одним ответом.
 *
 * Все четыре списка разом, а не по запросу на каждый: в форме заказа нужны
 * сразу все, и четыре запроса вместо одного ничего не экономят — суммарно
 * там несколько десятков строк.
 */
export interface DictionariesResponse {
  items: DictionaryItemDto[];
}

/** Вид списка обязателен: без него непонятно, куда добавлять значение. */
export interface CreateDictionaryItemRequest {
  kind: DictionaryKind;
  name: string;
}

/** Переименование и закрытие. Вид не меняется: это был бы перенос в другой список. */
export interface UpdateDictionaryItemRequest {
  name?: string;
  isActive?: boolean;
}
