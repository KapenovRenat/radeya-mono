import type { ReactNode } from "react";

/**
 * Вход в админку: без сайдбара, форма по центру.
 * Тема приходит из dashboard/layout.tsx уровнем выше.
 */
export default function DashboardAuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
