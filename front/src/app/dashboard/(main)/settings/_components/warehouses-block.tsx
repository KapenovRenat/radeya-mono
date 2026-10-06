"use client";

import { useId } from "react";
import { WAREHOUSE_NAME_MAX_LENGTH } from "@radeya/shared";

import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { useCreateWarehouseForm } from "@/features/warehouses/use-create-warehouse-form";
import { useGetWarehousesQuery } from "@/features/warehouses/warehouses-api";

/**
 * Склады: список справочника и создание нашего склада без Kaspi (шоурум в ТЦ).
 *
 * Склады Kaspi здесь не заводятся — они приходят из выгрузки на странице
 * синхронизации, вместе с `kaspiStoreId`, по которому матчатся заказы.
 */
export function WarehousesBlock() {
  const warehouses = useGetWarehousesQuery();
  const form = useCreateWarehouseForm();
  const formId = useId();
  const items = warehouses.data?.items ?? [];

  return (
    <section className="space-y-3" aria-labelledby={formId + "-title"}>
      <h2 id={formId + "-title"} className="text-lg font-semibold">Склады</h2>

      {items.length > 0 && (
        <ul className="max-w-xl divide-y divide-border rounded-md border border-border">
          {items.map((warehouse) => (
            <li key={warehouse.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="font-mono text-sm">{warehouse.code}</span>
              <span className="flex-1">{warehouse.name ?? "—"}</span>
              <Badge tone="neutral">{warehouse.kaspiStoreId === null ? "наш склад" : "Kaspi"}</Badge>
              {!warehouse.isActive && <Badge tone="danger">закрыт</Badge>}
            </li>
          ))}
        </ul>
      )}

      <form
        className="max-w-xl space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void form.submit();
        }}
      >
        <h3 className="font-medium">Новый склад без Kaspi</h3>

        <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <Input
            id={formId + "-code"}
            label="Код"
            value={form.code}
            onChange={(event) => form.setCode(event.target.value)}
            placeholder="NCITY"
            autoComplete="off"
            disabled={form.isSaving}
            className=""
          />
          <Input
            id={formId + "-name"}
            label="Название"
            value={form.name}
            onChange={(event) => form.setName(event.target.value)}
            maxLength={WAREHOUSE_NAME_MAX_LENGTH}
            placeholder="Шоурум Астана Ncity"
            autoComplete="off"
            disabled={form.isSaving}
            className=""
          />
        </div>

        <p className="text-sm text-muted-foreground">
          Для шоурума и других мест хранения без связи с Kaspi: на них ведутся остатки
          и документы склада, заказы Kaspi сюда не попадают.
        </p>

        {form.error && <p role="alert" aria-live="polite" className="text-sm text-destructive">{form.error}</p>}
        {form.created && <p aria-live="polite" className="text-sm">Склад {form.created} создан.</p>}

        <Button type="submit" disabled={form.isSaving} className="">
          {form.isSaving ? "Создаю…" : "Создать склад"}
        </Button>
      </form>
    </section>
  );
}
