import type {
  UpdateWorkerSettingsRequest,
  WorkerDto,
  WorkerKey,
  WorkersResponse,
} from "@radeya/shared";

import { baseApi } from "@/shared/api/base-api";

export const workersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** Настройки и состояние воркеров. */
    getWorkers: build.query<WorkersResponse, void>({
      query: () => ({ url: "/workers" }),
      providesTags: ["Worker"],
    }),

    /** Сохранить настройки — воркер подхватит их сам, без перезапуска. */
    updateWorkerSettings: build.mutation<WorkerDto, { key: WorkerKey } & UpdateWorkerSettingsRequest>({
      query: ({ key, ...body }) => ({ url: `/workers/${key}/settings`, method: "PUT", body }),
      invalidatesTags: ["Worker", "Audit"],
    }),
  }),
});

export const { useGetWorkersQuery, useUpdateWorkerSettingsMutation } = workersApi;
