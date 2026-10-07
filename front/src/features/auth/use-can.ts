"use client";

import { useCallback } from "react";
import { hasPermission, type Permission } from "@radeya/shared";

import { useAuth } from "./use-auth";

/**
 * Проверка права в интерфейсе — та же, что `can()` на сервере:
 *
 *   const can = useCan();
 *   can()                                  // любой вошедший
 *   can(PERMISSIONS.STOCK_DOCUMENTS_POST)  // есть галочка (админу — всегда)
 *   can([PERMISSIONS.A, PERMISSIONS.B])    // есть хотя бы одна
 *
 * Это удобство, а не защита: спрятанная кнопка ничего не закрывает.
 * Закрывает сервер — у маршрута должно стоять то же право.
 */
export function useCan() {
  const { user } = useAuth();

  return useCallback(
    (permission?: Permission | readonly Permission[]) => {
      if (user === null) return false;
      if (permission === undefined || typeof permission === "string") return hasPermission(user, permission);

      return permission.some((item) => hasPermission(user, item));
    },
    [user],
  );
}
