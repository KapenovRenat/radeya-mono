import type {
  CommitSupplierImportRequest,
  CommitSupplierImportResponse,
  SupplierDto,
  SupplierImportPreview,
  SuppliersResponse,
  UpdateSupplierRequest,
} from "@radeya/shared";

import { baseApi } from "@/shared/api/base-api";

export const suppliersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSuppliers: build.query<SuppliersResponse, void>({
      query: () => ({ url: "/suppliers" }),
      providesTags: ["Supplier"],
    }),

    /**
     * Разбор выгрузки контрагентов МойСклада. **В базу ничего не пишет.**
     *
     * Без `sheet` возвращается только список листов. Файл уходит двоичным телом:
     * `fetchBaseQuery` File не сериализует, поэтому он доезжает как есть.
     */
    previewSupplierImport: build.mutation<
      SupplierImportPreview,
      { file: File; sheet?: string }
    >({
      query: ({ file, sheet }) => ({
        url: "/suppliers/import/preview",
        method: "POST",
        params: sheet === undefined ? {} : { sheet },
        body: file,
      }),
    }),

    /** Запись. Сбрасывает `Supplier` — список обновится сам, и `Audit`: импорт пишется в журнал. */
    commitSupplierImport: build.mutation<
      CommitSupplierImportResponse,
      CommitSupplierImportRequest
    >({
      query: (body) => ({
        url: "/suppliers/import/commit",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Supplier", "Audit"],
    }),

    /** Правка карточки руками — прежде всего Telegram, которого в выгрузке нет. */
    updateSupplier: build.mutation<
      SupplierDto,
      { id: string } & UpdateSupplierRequest
    >({
      query: ({ id, ...body }) => ({
        url: `/suppliers/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Supplier", "Audit"],
    }),
  }),
});

export const {
  useGetSuppliersQuery,
  usePreviewSupplierImportMutation,
  useCommitSupplierImportMutation,
  useUpdateSupplierMutation,
} = suppliersApi;
