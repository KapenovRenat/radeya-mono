import type { OrderStatsQuery, OrderStatsResponse } from "@radeya/shared";

import { baseApi } from "@/shared/api/base-api";

export const statsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Сводка по заказам за период, в разрезе точек продаж.
     *
     * Тег `Order`: после синхронизации с Kaspi или импорта цифры обязаны
     * пересчитаться сами, иначе на странице будет вчерашняя выручка.
     */
    getOrderStats: build.query<OrderStatsResponse, OrderStatsQuery>({
      query: (params) => ({ url: "/stats/orders", params }),
      providesTags: ["Order"],
    }),
  }),
});

export const { useGetOrderStatsQuery } = statsApi;
