import type { ReactNode } from "react";
import { USER_ROLES } from "@radeya/shared";

import { RoleGuard } from "@/features/auth/role-guard";

/**
 * Раздел «Импорты» — только ADMIN.
 *
 * Проверка в layout, а не на странице: так она накроет все будущие блоки
 * раздела, и её нельзя будет забыть на новом. Импорт пишет в заказы пачкой,
 * и ошибка здесь стоит дороже, чем в любой форме.
 */
export default function ImportsLayout({ children }: { children: ReactNode }) {
  return <RoleGuard roles={[USER_ROLES.ADMIN]}>{children}</RoleGuard>;
}
