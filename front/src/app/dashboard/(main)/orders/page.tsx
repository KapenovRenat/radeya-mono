"use client";

import { useEffect, useState } from "react";
import { CATALOG_SEARCH_MAX_LENGTH, KASPI_ORDER_PERIODS,
  KASPI_ORDER_PERIOD_LABELS, SALES_POINT_TYPES, USER_ROLES } from "@radeya/shared";

import { Button } from "@/components/button";
import { DateRangePicker } from "@/components/date-range-picker";
import { Dropdown, type DropdownOption } from "@/components/dropdown";
import { Tables } from "@/components/tables";
import { useCan } from "@/features/auth/use-can";
import { useGetKaspiOrdersQuery } from "@/features/orders/orders-api";
import { useKaspiOrdersSync } from "@/features/orders/use-kaspi-orders-sync";
import { useOrdersList } from "@/features/orders/use-orders-list";
import { useGetSalesPointsQuery } from "@/features/sales-points/sales-points-api";
import { OrderDetailsModal } from "./_components/order-details";
import { OrderDictionaryFilters } from "./_components/order-dictionary-filters";
import { orderColumnCount, OrderRow, OrderTableHead,
  type OrderTableKind } from "./_components/order-row";

/** За сколько дней тянуть сырьё в консоль. Больше — дольше ждать Kaspi при каждой загрузке. */
const RAW_DAYS = 14;

export default function OrdersPage() {
  const can = useCan();
  const sync = useKaspiOrdersSync();
  const orders = useOrdersList();
  const salesPoints = useGetSalesPointsQuery();
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  const points = salesPoints.data?.items ?? [];
  const selectedPoint = points.find((point) => point.id === orders.salesPointIds[0]);
  const { setSalesPointIds } = orders;

  /**
   * Реестр всегда про одну точку: «всех точек» нет — у площадки и офлайн-точки
   * разные таблицы. По умолчанию Kaspi, найденный по типу, а не по названию:
   * название точки можно переименовать, тип — нет.
   */
  useEffect(() => {
    if (orders.salesPointIds.length > 0) return;

    const kaspi = points.find((point) => point.type === SALES_POINT_TYPES.KASPI) ?? points[0];

    if (kaspi) setSalesPointIds([kaspi.id]);
  }, [points, orders.salesPointIds.length, setSalesPointIds]);

  /** Вид таблицы — от вида точки: у офлайн-точки свои колонки и фильтры. */
  const tableKind: OrderTableKind = selectedPoint?.type === SALES_POINT_TYPES.OFFLINE
    ? "offline" : "marketplace";

  const pointOptions: DropdownOption[] = points.map((point) => ({
    value: point.id,
    label: point.name,
    // Закрытые точки в списке остаются — по ним смотрят заказы прошлых периодов.
    ...(point.isActive ? {} : { note: "закрыта" }),
  }));

  // Сырьё прямо из Kaspi — для разбора расхождений со складом. Запрос идёт
  // на площадку при каждой загрузке страницы, поэтому период короткий.
  // Только админу: маршрут закрыт can([ADMIN]), остальным прилетел бы 403.
  const kaspi = useGetKaspiOrdersQuery(
    { days: RAW_DAYS, raw: 1 },
    { skip: !can([USER_ROLES.ADMIN]) },
  );

  useEffect(() => {
    if (!kaspi.data) return;

    console.log("[Kaspi] Сырые заказы:", kaspi.data.rawOrders);
    console.log("[Kaspi] Разобранные:", kaspi.data.orders);
    console.log("[Kaspi] Встречено значений:", kaspi.data.seen);
    console.log("[Kaspi] Orders:", orders);
  }, [kaspi.data, orders]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Заказы</h1>

      <div className="flex flex-wrap items-center gap-2">
        <Button className="" type="button" disabled={sync.isRunning}
          onClick={() => void sync.start(KASPI_ORDER_PERIODS.LAST_2_YEARS)}>
          {KASPI_ORDER_PERIOD_LABELS[KASPI_ORDER_PERIODS.LAST_2_YEARS]}
        </Button>

        <Button className="" type="button" disabled={sync.isRunning}
          onClick={() => void sync.start(KASPI_ORDER_PERIODS.LAST_3_MONTHS)}>
          {KASPI_ORDER_PERIOD_LABELS[KASPI_ORDER_PERIODS.LAST_3_MONTHS]}
        </Button>

        {sync.isRunning && (
          <>
            <span className="text-sm text-muted-foreground" aria-live="polite">
              Синхронизация: {sync.progress}% — создано {sync.totals.created},
              обновлено {sync.totals.updated}
            </span>
            <Button className="" type="button" onClick={sync.cancel}>Остановить</Button>
          </>
        )}

        {!sync.isRunning && sync.totals.chunksTotal > 0 && (
          <span className="text-sm text-muted-foreground" aria-live="polite">
            Готово: создано {sync.totals.created}, обновлено {sync.totals.updated},
            пропущено {sync.totals.skipped}
          </span>
        )}
      </div>

      {/* Фильтры по спискам — только у офлайн-точки: у заказов площадки эти
          поля всегда пустые, и любой выбор давал бы пустую таблицу. */}
      {tableKind === "offline" && (
        <OrderDictionaryFilters
          value={orders.dictionaryFilter}
          onChange={orders.setDictionaryFilter}
          disabled={sync.isRunning}
        />
      )}

      {sync.error && <p role="alert" className="text-sm text-destructive">{sync.error}</p>}

      {sync.totals.unknownWarehouses.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Склады не из справочника: {sync.totals.unknownWarehouses.join(", ")}.
          Заказы сохранены без связи со складом.
        </p>
      )}

      {sync.totals.unknownValues.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Незнакомые значения Kaspi: {sync.totals.unknownValues.join(", ")}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-64 flex-1 space-y-1">
          <span className="text-sm">Поиск по номеру заказа</span>
          <input type="search" value={orders.search} maxLength={CATALOG_SEARCH_MAX_LENGTH}
            onChange={(event) => orders.setSearch(event.target.value)}
            placeholder="Например, 1055815957"
            className="w-full rounded-md border border-border bg-background px-3 py-2" />
        </label>

        <div className="min-w-56 space-y-1">
          <span className="text-sm">Точка продаж</span>
          <Dropdown
            mode="select"
            searchable
            searchPlaceholder="Поиск точки"
            label="Точка продаж"
            placeholder="Выберите точку"
            options={pointOptions}
            value={orders.salesPointIds[0]}
            onChange={(id) => orders.setSalesPointIds([id])}
            disabled={sync.isRunning || pointOptions.length === 0}
          />
        </div>

        <DateRangePicker
          label="Дата заказа"
          value={orders.range}
          onChange={orders.setRange}
          disabled={sync.isRunning}
        />
      </div>

      <Tables
        page={orders.page}
        pageSize={orders.pageSize}
        total={orders.total}
        onPageChange={orders.setPage}
        onPageSizeChange={orders.setPageSize}
        isLoading={orders.isLoading}
        error={orders.error}
        onRetry={orders.reload}
        head={<OrderTableHead kind={tableKind} />}
        columnCount={orderColumnCount(tableKind)}
        caption="Заказы"
        emptyLabel="Заказы не найдены"
      >
        {orders.items.map((order) => (
          <OrderRow key={order.id} order={order} kind={tableKind} onOpen={setOpenOrderId} />
        ))}
      </Tables>

      <OrderDetailsModal orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </div>
  );
}
