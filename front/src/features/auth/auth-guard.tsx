"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "./use-auth";

/**
 * Пускает внутрь только вошедших, остальных уводит на форму входа.
 *
 * Это защита интерфейса, а не безопасность: любой запрос всё равно проверяется
 * сервером на каждом обращении. Смысл в том, чтобы не показывать пустой дашборд
 * с ошибками там, где данных не будет.
 *
 * Пока идёт первая проверка, содержимое не рисуется — иначе на секунду мелькнёт
 * интерфейс, к которому у человека нет доступа.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/dashboard/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
