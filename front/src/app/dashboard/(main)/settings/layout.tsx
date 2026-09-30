import type { ReactNode } from "react";
import { USER_ROLES } from "@radeya/shared";

import { RoleGuard } from "@/features/auth/role-guard";

/**
 * Раздел «Настройки» — только ADMIN: здесь ключи от внешних систем.
 * Проверка в layout, чтобы накрыть и будущие блоки раздела.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <RoleGuard roles={[USER_ROLES.ADMIN]}>{children}</RoleGuard>;
}
