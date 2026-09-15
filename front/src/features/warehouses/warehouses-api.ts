import type {
  SaveWarehousesRequest,
  SaveWarehousesResponse,
  WarehouseDto,
} from "@radeya/shared";

import { baseApi } from "@/shared/api/base-api";

/**
 * Справочник складов. Импорт из выгрузки помечает тег `Warehouse`,
 * поэтому список после сохранения перезапрашивается сам.
 */
export const warehousesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getWarehouses: build.query<{ items: WarehouseDto[] }, void>({
      query: () => "/warehouses",
      providesTags: ["Warehouse"],
    }),

    importKaspiWarehouses: build.mutation<
      SaveWarehousesResponse,
      SaveWarehousesRequest
    >({
      query: (body) => ({
        url: "/warehouses/import-kaspi",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Warehouse"],
    }),
  }),
});

export const { useGetWarehousesQuery, useImportKaspiWarehousesMutation } =
  warehousesApi;
