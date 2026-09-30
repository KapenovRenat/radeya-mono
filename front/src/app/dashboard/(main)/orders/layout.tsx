import type { ReactNode } from "react";

import { RoleGuard } from "@/features/auth/role-guard";

/**
 * Раздел «Заказы» — всем вошедшим. Ограничить — перечислить роли:
 * `<RoleGuard roles={[USER_ROLES.ADMIN, USER_ROLES.MANAGER]}>`, и те же роли
 * поставить у маршрутов в server/src/modules/orders/orders.routes.ts.
 *
 * Проверка стоит в layout, а не на странице: так она автоматически накроет
 * все будущие подстраницы раздела, и её нельзя будет забыть на новой.
 */
export default function OrdersLayout({ children }: { children: ReactNode }) {
  return <RoleGuard>{children}</RoleGuard>;
}
