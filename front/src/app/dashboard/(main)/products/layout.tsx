import type { ReactNode } from "react";
import { PERMISSIONS } from "@radeya/shared";

import { PermissionGuard } from "@/features/auth/permission-guard";

/**
 * Раздел «Товары» — каталог (CATALOG_VIEW) и вложенные документы склада
 * (STOCK_DOCUMENTS_VIEW). Здесь хватает любого из двух: вложенный layout
 * оборачивается в этот, и кладовщик без каталога иначе не попал бы
 * в документы. Каталог закрыт своим правом на самой странице, документы —
 * в stock-documents/layout.tsx.
 */
export default function ProductsLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionGuard permission={[PERMISSIONS.CATALOG_VIEW, PERMISSIONS.STOCK_DOCUMENTS_VIEW]}>
      {children}
    </PermissionGuard>
  );
}
