import type { ReactNode } from "react";
import { PERMISSIONS } from "@radeya/shared";

import { PermissionGuard } from "@/features/auth/permission-guard";

/** Синхронизация с Kaspi — управление каталогом, право KASPI_SYNC. */
export default function KaspiSyncLayout({ children }: { children: ReactNode }) {
  return <PermissionGuard permission={PERMISSIONS.KASPI_SYNC}>{children}</PermissionGuard>;
}
