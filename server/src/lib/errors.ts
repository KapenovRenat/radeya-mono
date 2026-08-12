/**
 * Ошибки приложения.
 *
 * Правило: бросаем эти классы, а не голый Error. Тогда обработчик ошибок
 * сам поставит нужный HTTP-код, и не придётся возвращать res.status(...)
 * из каждого сервиса.
 */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** 400 — данные не прошли валидацию. */
export class ValidationError extends AppError {
  constructor(message = 'Некорректные данные', details?: Record<string, string[]>) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

/** 401 — не авторизован (не вошёл или сессия истекла). */
export class UnauthorizedError extends AppError {
  constructor(message = 'Требуется вход в систему') {
    super(401, 'UNAUTHORIZED', message);
  }
}

/** 403 — вошёл, но прав на действие нет. */
export class ForbiddenError extends AppError {
  constructor(message = 'Недостаточно прав') {
    super(403, 'FORBIDDEN', message);
  }
}

/** 404 — объекта не существует. */
export class NotFoundError extends AppError {
  constructor(message = 'Не найдено') {
    super(404, 'NOT_FOUND', message);
  }
}

/** 409 — конфликт: дубликат, устаревшая версия и т.п. */
export class ConflictError extends AppError {
  constructor(message = 'Конфликт данных') {
    super(409, 'CONFLICT', message);
  }
}
