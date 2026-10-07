import type { ReactNode } from "react";
import { PERMISSIONS } from "@radeya/shared";

import { PermissionGuard } from "@/features/auth/permission-guard";

/**
 * Раздел «Импорты» — право IMPORTS.
 *
 * Проверка в layout, а не на странице: так она накроет все будущие блоки
 * раздела, и её нельзя будет забыть на новом. Импорт пишет в заказы пачкой,
 * и ошибка здесь стоит дороже, чем в любой форме.
 */
export default function ImportsLayout({ children }: { children: ReactNode }) {
  return <PermissionGuard permission={PERMISSIONS.IMPORTS}>{children}</PermissionGuard>;
}
