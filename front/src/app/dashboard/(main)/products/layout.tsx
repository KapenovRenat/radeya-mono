import type { ReactNode } from "react";

import { RoleGuard } from "@/features/auth/role-guard";

/**
 * Раздел «Товары» — всем вошедшим. Закупка и себестоимость в таблице видны
 * только ролям из CATALOG_PURCHASE_ROLES / CATALOG_COST_ROLES (shared).
 * Ограничить раздел — перечислить роли в `roles`, и те же роли поставить
 * у маршрутов в server/src/modules/products/products.routes.ts.
 *
 * Проверка стоит в layout, а не на странице: так она автоматически накроет
 * все будущие подстраницы раздела, и её нельзя будет забыть на новой.
 */
export default function ProductsLayout({ children }: { children: ReactNode }) {
  return <RoleGuard>{children}</RoleGuard>;
}
