import type { CreateSalesPointRequest, SalesPointDto, SalesPointsResponse,
  UpdateSalesPointRequest } from "@radeya/shared";

import { baseApi } from "@/shared/api/base-api";

export const salesPointsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Справочник точек продаж целиком.
     *
     * Кэшируется тегом и живёт до первой правки: точек единицы, а нужны они
     * и в фильтре реестра, и в выпадашке при вводе заказа.
     */
    getSalesPoints: build.query<SalesPointsResponse, void>({
      query: () => ({ url: "/sales-points" }),
      providesTags: ["SalesPoint"],
    }),

    /** Создание офлайн-точки. Тип и код не передаются — их ставит сервер. */
    createSalesPoint: build.mutation<SalesPointDto, CreateSalesPointRequest>({
      query: (body) => ({ url: "/sales-points", method: "POST", body }),
      invalidatesTags: ["SalesPoint", "Audit"],
    }),

    /**
     * Переименование и закрытие.
     *
     * Сбрасывается и тег `Order`: в строке заказа стоит название точки,
     * и после переименования таблица обязана показать новое.
     */
    updateSalesPoint: build.mutation<
      SalesPointDto,
      UpdateSalesPointRequest & { id: string }
    >({
      query: ({ id, ...body }) => ({ url: `/sales-points/${id}`, method: "PATCH", body }),
      invalidatesTags: ["SalesPoint", "Order", "Audit"],
    }),
  }),
});

export const { useGetSalesPointsQuery, useCreateSalesPointMutation,
  useUpdateSalesPointMutation } = salesPointsApi;
