import type { ReactNode } from "react";
import { USER_ROLES } from "@radeya/shared";

import { RoleGuard } from "@/features/auth/role-guard";

/**
 * Раздел «Аккаунты и История» — только для админа.
 *
 * Проверка стоит в layout, а не на странице: так она автоматически накроет
 * все будущие подстраницы раздела, и её нельзя будет забыть на новой.
 */
export default function AccountsLayout({ children }: { children: ReactNode }) {
  return <RoleGuard roles={[USER_ROLES.ADMIN]}>{children}</RoleGuard>;
}
