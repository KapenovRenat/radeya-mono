import { baseApi } from "@/shared/api/base-api";

export interface HealthStatus {
  status: "ok" | "degraded";
  environment: string;
  uptimeSeconds: number;
  database: "ok" | "unavailable";
  timestamp: string;
}

/**
 * Образец подключения эндпоинта. Любой следующий модуль делается так же:
 * свой файл в features/<модуль>/, injectEndpoints, экспорт хуков.
 */
export const healthApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getHealth: build.query<HealthStatus, void>({
      query: () => "/health",
      providesTags: ["Health"],
    }),
  }),
});

export const { useGetHealthQuery } = healthApi;
