import type { ReactNode } from "react";
import { PERMISSIONS } from "@radeya/shared";

import { PermissionGuard } from "@/features/auth/permission-guard";

/**
 * Раздел «Аккаунты и История» — с правом на сотрудников или на журнал:
 * вкладки внутри показываются каждая по своему праву.
 *
 * Проверка стоит в layout, а не на странице: так она автоматически накроет
 * все будущие подстраницы раздела, и её нельзя будет забыть на новой.
 */
export default function AccountsLayout({ children }: { children: ReactNode }) {
  return <PermissionGuard permission={[PERMISSIONS.USERS_MANAGE, PERMISSIONS.AUDIT_VIEW]}>{children}</PermissionGuard>;
}
