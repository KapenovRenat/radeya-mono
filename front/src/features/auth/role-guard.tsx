"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { UserRole } from "@radeya/shared";

import { useAuth } from "./use-auth";

interface RoleGuardProps {
  /** Кому можно. Остальных уводит на `redirectTo`. */
  roles: UserRole[];
  children: ReactNode;
  redirectTo?: string;
}

/**
 * Ограничение раздела по ролям.
 *
 * Как и AuthGuard — это удобство интерфейса, а не безопасность. Настоящая
 * проверка стоит на сервере, в мидлваре requireRole: запрос уходит и без
 * интерфейса, а спрятанная кнопка ничего не защищает.
 *
 * Смысл в другом: не показывать раздел, где всё равно прилетит 403.
 */
export function RoleGuard({
  roles,
  children,
  redirectTo = "/dashboard",
}: RoleGuardProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const allowed = user ? roles.includes(user.role) : false;

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
