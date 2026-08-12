/**
 * Единая форма ошибки API. Сервер отдаёт только её,
 * front разбирает только её — без гадания по тексту сообщения.
 */
export interface ApiErrorResponse {
  error: {
    /** Машиночитаемый код: NOT_FOUND, VALIDATION_ERROR и т.п. */
    code: string;
    /** Сообщение для человека. Не содержит внутренних деталей. */
    message: string;
    /** Детали валидации: поле → что не так. Только для VALIDATION_ERROR. */
    details?: Record<string, string[]>;
  };
}

/** Ответ списочных эндпоинтов. Пагинация одинаковая во всём API. */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
