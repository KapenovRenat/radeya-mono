import type { ReactNode } from "react";

/**
 * Общая обвязка админки: тема на всё, что лежит под /dashboard,
 * включая страницу входа. Сайдбара здесь нет — он в (main)/layout.tsx,
 * иначе появился бы и на форме входа.
 */
export default function DashboardRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="theme-dashboard min-h-full">{children}</div>;
}
