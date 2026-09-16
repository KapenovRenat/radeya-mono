import type {
  ImportKaspiProductsRequest,
  ImportKaspiProductsResponse,
  KnownSkusResponse,
} from "@radeya/shared";

import { baseApi } from "@/shared/api/base-api";

/**
 * Каталог. Импорт помечает тег `Product`, поэтому список известных артикулов
 * перезапрашивается сам — и только что сохранённые товары сразу уходят
 * из таблицы новых.
 */
export const productsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getKnownSkus: build.query<KnownSkusResponse, void>({
      query: () => "/products/skus",
      providesTags: ["Product"],
    }),

    importKaspiProducts: build.mutation<
      ImportKaspiProductsResponse,
      ImportKaspiProductsRequest
    >({
      query: (body) => ({
        url: "/products/import-kaspi",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Product"],
    }),
  }),
});

export const { useGetKnownSkusQuery, useImportKaspiProductsMutation } =
  productsApi;
