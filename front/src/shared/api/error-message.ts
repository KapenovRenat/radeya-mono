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

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as ApiErrorResponse).error?.message === "string"
  );
}
