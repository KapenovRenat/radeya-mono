import type { CreateOrderCommentRequest, KaspiOrdersPreview, OrderCommentDto,
  OrderCommentsResponse, OrderDetailsDto, OrderListQuery, OrderListResponse,
  SyncKaspiOrdersRequest, SyncKaspiOrdersResponse,
  SyncOrderEntriesResponse } from "@radeya/shared";

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

    /** Заказ целиком для окна заказа. Тег с id — сбрасывается загрузкой состава. */
    getOrder: build.query<OrderDetailsDto, string>({
      query: (orderId) => ({ url: `/orders/${orderId}` }),
      providesTags: (_result, _error, orderId) => [{ type: "Order", id: orderId }],
    }),

    /**
     * Загрузка состава заказа Kaspi — при первом открытии окна.
     *
     * Ответ сразу кладётся в кэш `getOrder`: заказ с составом уже пришёл,
     * и перезапрашивать его вторым запросом незачем. Список сбрасывается —
     * в строке стоит счётчик позиций.
     */
    syncOrderEntries: build.mutation<SyncOrderEntriesResponse, string>({
      query: (orderId) => ({ url: `/orders/${orderId}/entries/sync`, method: "POST" }),
      async onQueryStarted(orderId, { dispatch, queryFulfilled }): Promise<void> {
        const { data } = await queryFulfilled.catch(() => ({ data: null }));

        if (data) dispatch(ordersApi.util.upsertQueryData("getOrder", orderId, data.order));
      },
      invalidatesTags: (result) => (result && result.created > 0 ? ["Order"] : []),
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

    /** Лента комментариев заказа, старые сверху. */
    getOrderComments: build.query<OrderCommentsResponse, string>({
      query: (orderId) => ({ url: `/orders/${orderId}/comments` }),
      // Тег с id: комментарий к одному заказу не должен сбрасывать ленту другого.
      providesTags: (_result, _error, orderId) => [{ type: "OrderComment", id: orderId }],
    }),

    /**
     * Новый комментарий.
     *
     * Сбрасывается и `Order`: в строке реестра стоит счётчик комментариев,
     * и после добавления он обязан вырасти.
     */
    addOrderComment: build.mutation<
      OrderCommentDto,
      CreateOrderCommentRequest & { orderId: string }
    >({
      query: ({ orderId, ...body }) => ({
        url: `/orders/${orderId}/comments`, method: "POST", body,
      }),
      invalidatesTags: (_result, _error, { orderId }) => [
        { type: "OrderComment", id: orderId },
        "Order",
      ],
    }),
  }),
});

export const { useGetOrdersQuery, useGetKaspiOrdersQuery, useLazyGetKaspiOrdersQuery,
  useSyncKaspiOrdersMutation, useGetOrderCommentsQuery,
  useAddOrderCommentMutation, useGetOrderQuery, useSyncOrderEntriesMutation } = ordersApi;
