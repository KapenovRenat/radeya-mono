import type { AuditLogEntry, PaginatedResponse } from "@radeya/shared";

import { baseApi } from "@/shared/api/base-api";

/** Журнал действий. Только чтение — записи не редактируются и не удаляются. */
export const auditApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAuditLog: build.query<PaginatedResponse<AuditLogEntry>, number | void>({
      query: (page) => ({
        url: "/audit",
        params: { page: page ?? 1 },
      }),
      providesTags: ["Audit"],
    }),
  }),
});

export const { useGetAuditLogQuery } = auditApi;
