import type {
  CommitMoyskladImportRequest,
  CommitMoyskladImportResponse,
  MoyskladImportPreview,
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
  }),
});

export const {
  usePreviewMoyskladImportMutation,
  useCommitMoyskladImportMutation,
} = moyskladApi;
