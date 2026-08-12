import type { ReactNode } from "react";

/**
 * Layout магазина. Папка (shop) в скобках — группа маршрутов:
 * в URL не попадает, но даёт разделу собственную обвязку и свои стили.
 *
 * Класс theme-shop переопределяет CSS-переменные (см. globals.css).
 */
export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <div className="theme-shop flex min-h-full flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
          <span className="text-lg font-semibold">RADEYA</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">
          RADEYA
        </div>
      </footer>
    </div>
  );
}
