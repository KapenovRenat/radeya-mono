import type { ApiErrorResponse } from "@radeya/shared";

/**
 * Достаёт текст ошибки из ответа RTK Query.
 *
 * Тип ошибки там `unknown`: это может быть ответ сервера, сетевой сбой
 * или исключение при разборе JSON. Разбирать это в каждом компоненте —
 * гарантированный способ однажды показать пользователю «[object Object]».
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== "object" || error === null) return fallback;

  const data = (error as { data?: unknown }).data;

  if (isApiErrorResponse(data)) {
    return data.error.message;
  }

  return fallback;
}

/**
 * Ошибки по полям из ответа VALIDATION_ERROR: поле → первое сообщение.
 * Сервер отдаёт массив претензий на поле, в форме показываем только первую —
 * список из трёх строк под одним полем читать невозможно.
 */
export function apiFieldErrors(error: unknown): Record<string, string> {
  if (typeof error !== "object" || error === null) return {};

  const data = (error as { data?: unknown }).data;

  if (!isApiErrorResponse(data) || !data.error.details) return {};

  return Object.fromEntries(
    Object.entries(data.error.details).map(([field, messages]) => [
      field,
      messages[0] ?? "",
    ]),
  );
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as ApiErrorResponse).error?.message === "string"
  );
}
