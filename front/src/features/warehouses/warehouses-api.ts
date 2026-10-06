import type {
  CreateWarehouseRequest,
  SaveWarehousesRequest,
  SaveWarehousesResponse,
  UpdateWarehouseRequest,
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

    /** Наш склад без Kaspi: шоурум, склад в ТЦ. */
    createWarehouse: build.mutation<WarehouseDto, CreateWarehouseRequest>({
      query: (body) => ({ url: "/warehouses", method: "POST", body }),
      invalidatesTags: ["Warehouse", "Audit"],
    }),

    /** Telegram-группы склада по виду доставки: Zammler, своя доставка, самовывоз. */
    updateWarehouse: build.mutation<WarehouseDto, { id: string } & UpdateWarehouseRequest>({
      query: ({ id, ...body }) => ({ url: `/warehouses/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Warehouse", "Audit"],
    }),
  }),
});

export const {
  useGetWarehousesQuery,
  useCreateWarehouseMutation,
  useImportKaspiWarehousesMutation,
  useUpdateWarehouseMutation,
} = warehousesApi;
