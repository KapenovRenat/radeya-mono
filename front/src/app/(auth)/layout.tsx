import type { ReactNode } from "react";

/**
 * Layout входа и регистрации: без шапки и сайдбара, форма по центру.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
