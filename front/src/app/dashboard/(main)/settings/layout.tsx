import type { ReactNode } from "react";

import { PermissionGuard } from "@/features/auth/permission-guard";
import { SETTINGS_PERMISSIONS } from "@/features/settings/settings-permissions";

/**
 * Раздел «Настройки» — с правом хотя бы на один блок; блоки внутри
 * показываются каждый по своему праву (page.tsx).
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <PermissionGuard permission={SETTINGS_PERMISSIONS}>{children}</PermissionGuard>;
}
