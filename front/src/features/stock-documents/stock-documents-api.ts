import type {
  SaveStockDocumentRequest,
  StockDocumentDto,
  StockDocumentListQuery,
  StockDocumentListResponse,
  StockPickerQuery,
  StockPickerResponse,
} from "@radeya/shared";

import { baseApi } from "@/shared/api/base-api";

/**
 * Документы склада: оприходование и списание.
 *
 * Проведение идёт галочкой «Проведено» в той же записи (`post: true`) и меняет
 * остатки, поэтому запись помечает и `Product` — таблица товаров перезапросит
 * остатки сама.
 */
export const stockDocumentsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getStockDocuments: build.query<StockDocumentListResponse, StockDocumentListQuery>({
      query: (params) => ({ url: "/stock-documents", params }),
      providesTags: ["StockDocument"],
    }),

    getStockDocument: build.query<StockDocumentDto, number>({
      query: (number) => `/stock-documents/${number}`,
      providesTags: (_result, _error, number) => [{ type: "StockDocument", id: number }],
    }),

    /** Товары для окна выбора: поиск как в каталоге, остаток — на складе документа. */
    getStockPickerVariants: build.query<StockPickerResponse, StockPickerQuery>({
      query: (params) => ({ url: "/stock-documents/variants", params }),
      providesTags: ["Product"],
    }),

    createStockDocument: build.mutation<StockDocumentDto, SaveStockDocumentRequest>({
      query: (body) => ({ url: "/stock-documents", method: "POST", body }),
      invalidatesTags: ["StockDocument", "Product", "Audit"],
    }),

    updateStockDocument: build.mutation<StockDocumentDto, { number: number } & SaveStockDocumentRequest>({
      query: ({ number, ...body }) => ({ url: `/stock-documents/${number}`, method: "PUT", body }),
      invalidatesTags: ["StockDocument", "Product", "Audit"],
    }),

    deleteStockDocument: build.mutation<void, number>({
      query: (number) => ({ url: `/stock-documents/${number}`, method: "DELETE" }),
      invalidatesTags: ["StockDocument", "Audit"],
    }),
  }),
});

export const {
  useGetStockDocumentsQuery,
  useGetStockDocumentQuery,
  useGetStockPickerVariantsQuery,
  useCreateStockDocumentMutation,
  useUpdateStockDocumentMutation,
  useDeleteStockDocumentMutation,
} = stockDocumentsApi;
