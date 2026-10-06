import type { ReactNode } from "react";
import { STOCK_DOCUMENT_ROLES } from "@radeya/shared";

import { RoleGuard } from "@/features/auth/role-guard";

/**
 * Документы склада — только STOCK_DOCUMENT_ROLES: в документе видна
 * себестоимость. Те же роли стоят у маршрутов на сервере
 * (server/src/modules/stock-documents/stock-documents.routes.ts).
 */
export default function StockDocumentsLayout({ children }: { children: ReactNode }) {
  return <RoleGuard roles={STOCK_DOCUMENT_ROLES} redirectTo="/dashboard/products">{children}</RoleGuard>;
}
