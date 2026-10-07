import type { ReactNode } from "react";
import { PERMISSIONS } from "@radeya/shared";

import { PermissionGuard } from "@/features/auth/permission-guard";

/**
 * Раздел «Заказы» — право ORDERS_VIEW; то же право стоит у маршрутов
 * в server/src/modules/orders/orders.routes.ts.
 *
 * Проверка стоит в layout, а не на странице: так она автоматически накроет
 * все будущие подстраницы раздела, и её нельзя будет забыть на новой.
 */
export default function OrdersLayout({ children }: { children: ReactNode }) {
  return <PermissionGuard permission={PERMISSIONS.ORDERS_VIEW}>{children}</PermissionGuard>;
}
