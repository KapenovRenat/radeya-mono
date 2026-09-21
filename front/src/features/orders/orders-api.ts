import type { KaspiOrdersPreview, OrderListQuery, OrderListResponse,
  SyncKaspiOrdersRequest, SyncKaspiOrdersResponse } from "@radeya/shared";

import { baseApi } from "@/shared/api/base-api";

export interface KaspiOrdersQuery {
  /** Сколько дней назад от текущего момента. По умолчанию на сервере 14. */
  days?: number;
  /** Страница Kaspi, с нуля. */
  page?: number;
  pageSize?: number;
  /** 1 — добавить к ответу сырые заказы целиком. */
  raw?: 0 | 1;
}

export const ordersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Страница заказов Kaspi, разобранная в нашу модель.
     *
     * Рядом с разобранным едет первый заказ сырым (`sample`) — сверять
     * маппинг глазами, не открывая Kaspi отдельно.
     */
    /** Страница заказов из нашей базы: поиск по номеру, свежие сверху. */
    getOrders: build.query<OrderListResponse, OrderListQuery>({
      query: (params) => ({ url: "/orders", params }),
      providesTags: ["Order"],
    }),

    getKaspiOrders: build.query<KaspiOrdersPreview, KaspiOrdersQuery | void>({
      query: (params) => ({ url: "/orders/kaspi", params: params ?? {} }),
    }),

    /**
     * Шаг синхронизации: читает заказы из Kaspi и пишет в базу.
     *
     * Один вызов — пачка трёхдневных отрезков. Повторять, пока не придёт
     * `done`; готовый цикл — в `useKaspiOrdersSync`.
     */
    syncKaspiOrders: build.mutation<SyncKaspiOrdersResponse, SyncKaspiOrdersRequest>({
      query: (body) => ({ url: "/orders/sync", method: "POST", body }),
      // Тег Order сбрасываем только на последнем шаге, иначе список заказов
      // перезапрашивался бы после каждого из десятка вызовов.
      invalidatesTags: (result) => (result?.done ? ["Order", "Audit"] : ["Audit"]),
    }),
  }),
});

export const { useGetOrdersQuery, useGetKaspiOrdersQuery, useLazyGetKaspiOrdersQuery,
  useSyncKaspiOrdersMutation } = ordersApi;
