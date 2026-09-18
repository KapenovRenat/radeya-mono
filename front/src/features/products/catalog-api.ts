import type { CatalogQuery, CatalogResponse, MoveProductsRequest,
  MoveProductsResponse } from "@radeya/shared";
import { baseApi } from "@/shared/api/base-api";

export const catalogApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCatalog: build.query<CatalogResponse, CatalogQuery>({
      query: (params) => ({ url: "/products/variants", params }),
      providesTags: ["Product"],
    }),
    moveProductsToCategory: build.mutation<MoveProductsResponse, MoveProductsRequest>({
      query: (body) => ({ url: "/products/category", method: "PATCH", body }),
      invalidatesTags: ["Product", "Audit"],
    }),
  }),
});
export const { useGetCatalogQuery, useMoveProductsToCategoryMutation } = catalogApi;
