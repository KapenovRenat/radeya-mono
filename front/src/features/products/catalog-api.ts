import type { CatalogQuery, CatalogResponse, MoveProductsRequest,
  MoveProductsResponse } from "@radeya/shared";
import { baseApi } from "@/shared/api/base-api";

/**
 * Списки в адресе — через запятую, пустой список не отправляется вовсе.
 * Явно, а не полагаясь на то, как fetchBaseQuery превращает массив в строку.
 */
function toParams({ warehouseIds, supplierIds, ...rest }: CatalogQuery) {
  return {
    ...rest,
    ...(warehouseIds?.length ? { warehouseIds: warehouseIds.join(",") } : {}),
    ...(supplierIds?.length ? { supplierIds: supplierIds.join(",") } : {}),
  };
}

export const catalogApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCatalog: build.query<CatalogResponse, CatalogQuery>({
      query: (params) => ({ url: "/products/variants", params: toParams(params) }),
      providesTags: ["Product"],
    }),
    moveProductsToCategory: build.mutation<MoveProductsResponse, MoveProductsRequest>({
      query: (body) => ({ url: "/products/category", method: "PATCH", body }),
      invalidatesTags: ["Product", "Audit"],
    }),
  }),
});
export const { useGetCatalogQuery, useMoveProductsToCategoryMutation } = catalogApi;
