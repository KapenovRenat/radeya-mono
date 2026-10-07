import type { ReactNode } from "react";
import { PERMISSIONS } from "@radeya/shared";

import { PermissionGuard } from "@/features/auth/permission-guard";

/**
 * Документы склада — право STOCK_DOCUMENTS_VIEW: в документе видна
 * себестоимость. То же право стоит у маршрутов на сервере
 * (server/src/modules/stock-documents/stock-documents.routes.ts).
 */
export default function StockDocumentsLayout({ children }: { children: ReactNode }) {
  return <PermissionGuard permission={PERMISSIONS.STOCK_DOCUMENTS_VIEW}>{children}</PermissionGuard>;
}
