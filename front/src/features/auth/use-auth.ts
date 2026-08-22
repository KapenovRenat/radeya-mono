"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { AuthUser } from "@radeya/shared";

import { useGetMeQuery, useLogoutMutation } from "./auth-api";

interface UseAuthResult {
  user: AuthUser | null;
  /** Первая загрузка: ещё неизвестно, вошёл пользователь или нет. */
  isLoading: boolean;
  isAuthenticated: boolean;
}

/**
 * Текущий пользователь.
 *
 * Отдельного слайса в сторе нет намеренно: кэш RTK Query и так лежит в сторе,
 * а копия в слайсе — второй источник правды, который рано или поздно разъедется
 * с первым. Хук можно звать из любого компонента, повторного запроса не будет.
 */
export function useAuth(): UseAuthResult {
  const { data, isLoading, isError } = useGetMeQuery();

  return {
    user: data?.user ?? null,
    isLoading,
    isAuthenticated: Boolean(data?.user) && !isError,
  };
}

/**
 * Выход. Кука снимается сервером, кэш чистится инвалидацией тега "Auth".
 *
 * `replace`, а не `push`: после выхода кнопка «назад» не должна возвращать
 * на страницу, куда доступа уже нет.
 */
export function useLogout() {
  const router = useRouter();
  const [logout, { isLoading }] = useLogoutMutation();

  const handleLogout = useCallback(async () => {
    try {
      await logout().unwrap();
    } finally {
      // Даже если запрос не прошёл, увести со страницы всё равно нужно:
      // пользователь нажал «выйти» и должен оказаться на входе.
      router.replace("/dashboard/login");
    }
  }, [logout, router]);

  return { logout: handleLogout, isLoading };
}
