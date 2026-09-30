"use client";

import { useCallback } from "react";
import { hasRole, type UserRole } from "@radeya/shared";

import { useAuth } from "./use-auth";

/**
 * Проверка доступа в интерфейсе — та же, что `can()` на сервере:
 *
 *   const can = useCan();
 *   can()                 // любой вошедший
 *   can([USER_ROLES.ADMIN]) // только админ
 *
 * Это удобство, а не защита: спрятанная кнопка ничего не закрывает.
 * Закрывает сервер — у маршрута должны стоять те же роли.
 */
export function useCan() {
  const { user } = useAuth();

  return useCallback(
    (roles?: readonly UserRole[]) => user !== null && hasRole(user.role, roles),
    [user],
  );
}
