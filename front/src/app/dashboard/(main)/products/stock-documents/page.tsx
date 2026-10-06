"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";
import { Plus } from "lucide-react";
import { STOCK_DOCUMENT_TYPES, STOCK_DOCUMENT_TYPE_LABELS } from "@radeya/shared";

import { Button } from "@/components/button";
import { Dropdown, type DropdownOption } from "@/components/dropdown";
import { Input } from "@/components/input";
import { Tables } from "@/components/tables";
import { useStockDocumentsList } from "@/features/stock-documents/use-stock-documents-list";
import { useGetWarehousesQuery } from "@/features/warehouses/warehouses-api";
import { STOCK_DOCUMENTS_HREF, warehouseLabel } from "./_components/document-meta";
import {
  STOCK_DOCUMENTS_COLUMN_COUNT,
  StockDocumentRow,
  StockDocumentsTableHead,
} from "./_components/stock-documents-table";

/** «Все» — пустая строка: так фильтр снимается тем же списком, что и ставится. */
const TYPE_FILTER_OPTIONS: DropdownOption[] = [
  { value: "", label: "Все типы" },
  ...Object.values(STOCK_DOCUMENT_TYPES).map((type) => ({ value: type, label: STOCK_DOCUMENT_TYPE_LABELS[type] })),
];

/** Документы склада: оприходования и списания, свежие сверху. */
export default function StockDocumentsPage() {
  const router = useRouter();
  const numberId = useId();
  const list = useStockDocumentsList();
  const warehouses = useGetWarehousesQuery();

  // Закрытые склады в фильтре остаются: по ним ищут старые документы.
  const warehouseOptions: DropdownOption[] = [
    { value: "", label: "Все склады" },
    ...(warehouses.data?.items ?? []).map((warehouse) => ({
      value: warehouse.id,
      label: warehouseLabel(warehouse),
      ...(warehouse.isActive ? {} : { note: "закрыт" }),
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Документы склада</h1>
        <Button type="button" onClick={() => router.push(`${STOCK_DOCUMENTS_HREF}/new`)} className="">
          <Plus size={16} aria-hidden="true" /> Создать документ
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <span className="text-sm">Тип</span>
          <Dropdown mode="select" label="Тип документа" options={TYPE_FILTER_OPTIONS}
            value={list.type} onChange={list.setType} />
        </div>

        <div className="space-y-1">
          <span className="text-sm">Склад</span>
          <Dropdown mode="select" searchable searchPlaceholder="Поиск склада" label="Склад"
            options={warehouseOptions} value={list.warehouseId} onChange={list.setWarehouseId} />
        </div>

        <div className="space-y-1">
          <label className="text-sm" htmlFor={numberId}>Номер</label>
          <Input id={numberId} type="search" inputMode="numeric" placeholder="Например, 00128"
            value={list.numberInput} onChange={(event) => list.setNumberInput(event.target.value)}
            autoComplete="off" className="" />
        </div>
      </div>

      <Tables
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={list.reload}
        head={<StockDocumentsTableHead />}
        columnCount={STOCK_DOCUMENTS_COLUMN_COUNT}
        caption="Документы склада"
        emptyLabel="Документов нет"
      >
        {list.items.map((item) => <StockDocumentRow key={item.id} item={item} />)}
      </Tables>
    </div>
  );
}
