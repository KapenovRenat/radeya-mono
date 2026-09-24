import type { CommitOfflineImportRequest, CommitOfflineImportResponse,
  OfflineImportPreview } from "@radeya/shared";

import { baseApi } from "@/shared/api/base-api";

export const importsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Разбор книги Excel. **В базу ничего не пишет.**
     *
     * Без `sheet` возвращается только список листов: в рабочей книге их сотня,
     * и разбирать наугад нечего.
     *
     * Файл уходит двоичным телом, а не multipart: полей у запроса всего одно,
     * и ради него городить форму с границами частей незачем. `fetchBaseQuery`
     * File не сериализует, поэтому он доезжает как есть.
     */
    previewOfflineImport: build.mutation<
      OfflineImportPreview,
      { file: File; sheet?: string }
    >({
      query: ({ file, sheet }) => ({
        url: "/imports/offline-orders/preview",
        method: "POST",
        params: sheet === undefined ? {} : { sheet },
        body: file,
      }),
    }),

    /**
     * Запись разобранных строк.
     *
     * Сбрасывает `Order`: в реестре должны появиться новые заказы. И `Audit` —
     * импорт пишется в журнал.
     */
    commitOfflineImport: build.mutation<
      CommitOfflineImportResponse,
      CommitOfflineImportRequest
    >({
      query: (body) => ({
        url: "/imports/offline-orders/commit",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Order", "Audit"],
    }),
  }),
});

export const { usePreviewOfflineImportMutation,
  useCommitOfflineImportMutation } = importsApi;
