import type { ReactNode } from "react";
import { USER_ROLES } from "@radeya/shared";

import { RoleGuard } from "@/features/auth/role-guard";

/** Синхронизация с Kaspi — управление каталогом, только для админа. */
export default function KaspiSyncLayout({ children }: { children: ReactNode }) {
  return <RoleGuard roles={[USER_ROLES.ADMIN]}>{children}</RoleGuard>;
}
