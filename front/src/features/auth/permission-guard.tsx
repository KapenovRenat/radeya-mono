"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { Permission } from "@radeya/shared";

import { useAuth } from "./use-auth";
import { useCan } from "./use-can";

interface PermissionGuardProps {
  /**
   * Какое право нужно. Массив — хватит любого из них (раздел с несколькими
   * блоками). Не указано — всем вошедшим. Остальных уводит на `redirectTo`.
   */
  permission?: Permission | readonly Permission[];
  children: ReactNode;
  redirectTo?: string;
}

/**
 * Ограничение раздела по праву — ставится в `layout.tsx` раздела.
 *
 * Как и AuthGuard — это удобство интерфейса, а не безопасность. Настоящая
 * проверка стоит на сервере, в `can()` у маршрута: запрос уходит и без
 * интерфейса, а спрятанная кнопка ничего не защищает.
 *
 * Смысл в другом: не показывать раздел, где всё равно прилетит 403.
 */
export function PermissionGuard({
  permission,
  children,
  redirectTo = "/dashboard",
}: PermissionGuardProps) {
  const router = useRouter();
  const { isLoading } = useAuth();
  const can = useCan();

  const allowed = can(permission);

  useEffect(() => {
    if (!isLoading && !allowed) {
      // replace, а не push: кнопка «назад» не должна возвращать туда, куда нельзя.
      router.replace(redirectTo);
    }
  }, [isLoading, allowed, redirectTo, router]);

  if (isLoading || !allowed) {
    return null;
  }

  return <>{children}</>;
}
