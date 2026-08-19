import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Разделы админки с сайдбаром. Всё, что внутри (main), получает меню;
 * вход лежит в соседней группе (auth) и остаётся без него.
 *
 * Пункты меню — заготовка по разделам из roadmap, страницы появятся по этапам.
 */
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/analytics", label: "Аналитика" },
  { href: "/dashboard/orders", label: "Заказы" },
  { href: "/dashboard/products", label: "Товары" },
  { href: "/dashboard/suppliers", label: "Поставщики" },
  { href: "/dashboard/users", label: "Пользователи" },
] as const;

export default function DashboardMainLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full">
      <main className="flex-1 px-6 py-6">{children}</main>
    </div>
  );
}
