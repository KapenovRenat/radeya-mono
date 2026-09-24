import type { SalesPointType } from '../constants/sales-points';

/**
 * Точка продаж наружу.
 *
 * `code` отдаётся вместе с `id` не для связей — связи по `id`, — а чтобы клиент
 * мог отличить системную точку от офлайновой без второго запроса и, например,
 * не предлагать переименовать Kaspi.
 */
export interface SalesPointDto {
  id: string;
  code: string;
  name: string;
  type: SalesPointType;
  /** Закрытая точка не предлагается при создании заказа, но остаётся в фильтрах. */
  isActive: boolean;
  sortOrder: number;
  /** Сколько заказов уже привязано. Нужен, чтобы объяснить, почему точку не удалить. */
  ordersCount: number;
}

export interface SalesPointsResponse {
  items: SalesPointDto[];
}

/**
 * Создание точки. Тип не передаётся: через API заводится только офлайн-точка,
 * системные приезжают сидом миграции.
 */
export interface CreateSalesPointRequest {
  name: string;
}

/** Переименование и закрытие. Оба поля необязательны, но хотя бы одно нужно. */
export interface UpdateSalesPointRequest {
  name?: string;
  isActive?: boolean;
}
