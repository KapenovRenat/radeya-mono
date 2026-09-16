"use client";

import { Button } from "@/components/button";
import { useSaveWarehouses } from "@/features/warehouses/use-save-warehouses";

/**
 * Склад в том виде, в каком его показывает панель.
 *
 * Общая форма для обоих источников: разбора XML-выгрузки и обхода кабинета.
 * `totalStock` необязателен — в выгрузке остаток по складу не считается.
 */
export interface WarehouseRow {
  code: string;
  storeId: string;
  cityId: string | null;
  offersCount: number;
  totalStock?: number;
}

interface WarehousesPanelProps {
  warehouses: readonly WarehouseRow[];
  /** Откуда список: «выгрузка» или «кабинет» — чтобы не гадать, что на экране. */
  source: string;
}

/**
 * Склады источника и кнопка сохранения их в справочник.
 *
 * Один компонент на оба источника: справочник один, и правила сохранения
 * у него тоже одни. Своё состояние сохранения у каждого экземпляра.
 */
export function WarehousesPanel({ warehouses, source }: WarehousesPanelProps) {
  const { saveWarehouses, isSaving, result, error } = useSaveWarehouses();

  const showStock = warehouses.some(
    (warehouse) => warehouse.totalStock !== undefined,
  );

  // Город известен не всегда: в JSON кабинета его нет ни у одного склада.
  const noCity =
    warehouses.length > 0 &&
    warehouses.every((warehouse) => warehouse.cityId === null);

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 text-sm font-medium">
        Склады в {source}: {warehouses.length}
      </div>

      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-1 font-medium">Код</th>
            <th className="py-1 font-medium">storeId</th>
            <th className="py-1 font-medium">Город (КАТО)</th>
            <th className="py-1 font-medium">Товаров</th>
            {showStock && <th className="py-1 font-medium">Остаток</th>}
          </tr>
        </thead>
        <tbody>
          {warehouses.map((warehouse) => (
            <tr key={warehouse.code} className="border-t">
              <td className="py-1 font-medium">{warehouse.code}</td>
              <td className="py-1 text-muted-foreground">{warehouse.storeId}</td>
              <td className="py-1 text-muted-foreground">
                {warehouse.cityId ?? "—"}
              </td>
              <td className="py-1">{warehouse.offersCount}</td>
              {showStock && <td className="py-1">{warehouse.totalStock ?? "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      {noCity && (
        <p className="mt-2 text-sm text-muted-foreground">
          Кода города кабинет не отдаёт. У складов, уже заведённых в справочнике,
          город останется прежним; у новых его нужно вписать вручную или
          дозаполнить разбором выгрузки.
        </p>
      )}

      {/* Склады сохраняются отдельно от товаров: это справочник, он не ждёт,
          пока мы проверим разбор названий и артикулов. */}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3">
        <Button
          type="button"
          onClick={() => saveWarehouses(warehouses)}
          disabled={isSaving || warehouses.length === 0}
        >
          {isSaving ? "Сохраняю…" : "Сохранить склады в БД"}
        </Button>

        {result && (
          <span className="text-sm text-muted-foreground">
            Добавлено {result.created}, обновлено {result.updated}, без изменений{" "}
            {result.unchanged}
          </span>
        )}

        {error && <span className="text-sm text-destructive">{error}</span>}

        {!result && !error && (
          <span className="text-sm text-muted-foreground">
            Повторное сохранение безопасно: названия складов, вписанные вручную,
            не перезаписываются
          </span>
        )}
      </div>
    </div>
  );
}
