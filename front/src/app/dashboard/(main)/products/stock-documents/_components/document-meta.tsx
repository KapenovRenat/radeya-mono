import { formatStockDocumentNumber, type StockDocumentWarehouseDto } from "@radeya/shared";

import { Badge } from "@/components/badge";

/** Общее списка и карточки документа: адрес, подпись склада, статус. */

export const STOCK_DOCUMENTS_HREF = "/dashboard/products/stock-documents";

/** Адрес документа — с номером как на экране: его копируют и пересылают. */
export function documentHref(number: number): string {
  return `${STOCK_DOCUMENTS_HREF}/${formatStockDocumentNumber(number)}`;
}

/** Код и название вместе: код — как склад зовётся в Kaspi, название — понятное человеку. */
export function warehouseLabel(warehouse: Pick<StockDocumentWarehouseDto, "code" | "name">): string {
  return warehouse.name === null ? warehouse.code : `${warehouse.code} · ${warehouse.name}`;
}

/** «Проведён» — остатки изменены; «Черновик» — ещё нет. */
export function DocumentStatus({ postedAt }: { postedAt: string | null }) {
  return postedAt === null
    ? <Badge tone="neutral">Черновик</Badge>
    : <Badge tone="success">Проведён</Badge>;
}
