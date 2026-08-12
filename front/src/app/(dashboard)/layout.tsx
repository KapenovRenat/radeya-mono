import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Layout админки: сайдбар и рабочая область.
 * Пункты меню — заготовка по разделам из roadmap, страницы появятся по этапам.
 */
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/analytics", label: "Аналитика" },
  { href: "/orders", label: "Заказы" },
  { href: "/products", label: "Товары" },
  { href: "/suppliers", label: "Поставщики" },
  { href: "/users", label: "Пользователи" },
] as const;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="theme-dashboard flex min-h-full">
      <aside className="w-56 shrink-0 border-r bg-sidebar">
        <div className="flex h-16 items-center px-4 text-lg font-semibold">
          RADEYA
        </div>

        <nav className="flex flex-col gap-1 px-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex-1 px-6 py-6">{children}</main>
    </div>
  );
}
