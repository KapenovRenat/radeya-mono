"use client";

import { OfflineOrdersImport } from "./_components/offline-orders-import";
import { SuppliersImport } from "./_components/suppliers-import";

/**
 * Импорты — набор независимых блоков, по одному на источник данных.
 *
 * Разделение по блокам, а не по вкладкам: источников будет несколько, они
 * не связаны между собой, и переключение скрывало бы от человека, что ещё
 * можно импортировать.
 */
export default function ImportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Импорты</h1>

      <OfflineOrdersImport />
      <SuppliersImport />
    </div>
  );
}
