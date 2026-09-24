"use client";

import { useEffect } from "react";
import { CATALOG_SEARCH_MAX_LENGTH, KASPI_ORDER_PERIODS,
  KASPI_ORDER_PERIOD_LABELS, SALES_POINT_TYPES } from "@radeya/shared";

import { Button } from "@/components/button";
import { DateRangePicker } from "@/components/date-range-picker";
import { Tables } from "@/components/tables";
import { useGetKaspiOrdersQuery } from "@/features/orders/orders-api";
import { useKaspiOrdersSync } from "@/features/orders/use-kaspi-orders-sync";
import { useOrdersList } from "@/features/orders/use-orders-list";
import { useGetSalesPointsQuery } from "@/features/sales-points/sales-points-api";
import { OrderDictionaryFilters } from "./_components/order-dictionary-filters";
import { orderColumnCount, OrderRow, OrderTableHead } from "./_components/order-row";

/** За сколько дней тянуть сырьё в консоль. Больше — дольше ждать Kaspi при каждой загрузке. */
const RAW_DAYS = 14;

export default function OrdersPage() {
  const sync = useKaspiOrdersSync();
  const orders = useOrdersList();
  const salesPoints = useGetSalesPointsQuery();

  /**
   * Колонки офлайн-продажи прячутся, когда в фильтре выбрана площадка:
   * у заказов Kaspi эти поля пустые, и восемь колонок из прочерков читать
   * невозможно. Пока фильтр не выбран, показываем всё — в реестре тогда
   * лежат заказы обоих видов.
   */
  const selectedPoint = (salesPoints.data?.items ?? [])
    .find((point) => point.id === orders.salesPointIds[0]);
  const showOffline = selectedPoint === undefined
    || selectedPoint.type === SALES_POINT_TYPES.OFFLINE;

  // Сырьё прямо из Kaspi — для разбора расхождений со складом. Запрос идёт
  // на площадку при каждой загрузке страницы, поэтому период короткий.
  const kaspi = useGetKaspiOrdersQuery({ days: RAW_DAYS, raw: 1 });

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

      {/* Фильтры по спискам офлайн-точки стоят сразу под кнопками: они задают
          разрез всего реестра, а поиск и период — уже уточнение внутри него. */}
      <OrderDictionaryFilters
        value={orders.dictionaryFilter}
        onChange={orders.setDictionaryFilter}
        disabled={sync.isRunning}
      />

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

        {/* Пустое значение — «все точки», а не «ни одной»: сняв фильтр,
            человек ждёт полный реестр, а не пустую таблицу. Закрытые точки
            в списке остаются — по ним смотрят заказы за прошлые периоды. */}
        <label className="min-w-56 space-y-1">
          <span className="text-sm">Точка продаж</span>
          <select
            value={orders.salesPointIds[0] ?? ""}
            disabled={sync.isRunning}
            onChange={(event) => {
              orders.setSalesPointIds(event.target.value === "" ? [] : [event.target.value]);
            }}
            className="h-[42px] w-full rounded-md border border-border bg-background px-3"
          >
            <option value="">Все точки</option>
            {(salesPoints.data?.items ?? []).map((point) => (
              <option key={point.id} value={point.id}>
                {point.name}{point.isActive ? "" : " (закрыта)"}
              </option>
            ))}
          </select>
        </label>

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
        head={<OrderTableHead showOffline={showOffline} />}
        columnCount={orderColumnCount(showOffline)}
        caption="Заказы"
        emptyLabel="Заказы не найдены"
      >
        {orders.items.map((order) => (
          <OrderRow key={order.id} order={order} showOffline={showOffline} />
        ))}
      </Tables>
    </div>
  );
}
