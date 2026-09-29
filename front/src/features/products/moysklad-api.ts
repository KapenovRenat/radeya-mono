import type {
  CommitMoyskladImportRequest,
  CommitMoyskladImportResponse,
  CommitStockImportRequest,
  CommitStockImportResponse,
  MoyskladImportPreview,
  StockImportPreview,
} from "@radeya/shared";

import { baseApi } from "@/shared/api/base-api";

export const moyskladApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Разбор выгрузки товаров МойСклада. **В базу ничего не пишет.**
     *
     * Файл уходит двоичным телом: `fetchBaseQuery` File не сериализует,
     * поэтому он доезжает как есть.
     */
    previewMoyskladImport: build.mutation<
      MoyskladImportPreview,
      { file: File; sheet?: string }
    >({
      query: ({ file, sheet }) => ({
        url: "/products/moysklad/preview",
        method: "POST",
        params: sheet === undefined ? {} : { sheet },
        body: file,
      }),
    }),

    /** Запись. Сбрасывает `Product` — таблица каталога покажет новую закупку. */
    commitMoyskladImport: build.mutation<
      CommitMoyskladImportResponse,
      CommitMoyskladImportRequest
    >({
      query: (body) => ({
        url: "/products/moysklad/commit",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Product", "Audit"],
    }),

    /**
     * Разбор отчёта «Остатки» для выбранного склада. **В базу ничего не пишет.**
     * Склад нужен уже здесь: от него зависит список того, что обнулится.
     */
    previewStockImport: build.mutation<
      StockImportPreview,
      { file: File; warehouseId: string; sheet?: string }
    >({
      query: ({ file, warehouseId, sheet }) => ({
        url: "/products/moysklad/stock/preview",
        method: "POST",
        params: sheet === undefined ? { warehouseId } : { warehouseId, sheet },
        body: file,
      }),
    }),

    /** Запись остатков. Сбрасывает `Product` — таблица каталога покажет новые цифры. */
    commitStockImport: build.mutation<CommitStockImportResponse, CommitStockImportRequest>({
      query: (body) => ({
        url: "/products/moysklad/stock/commit",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Product", "Audit"],
    }),
  }),
});

export const {
  usePreviewMoyskladImportMutation,
  useCommitMoyskladImportMutation,
  usePreviewStockImportMutation,
  useCommitStockImportMutation,
} = moyskladApi;
