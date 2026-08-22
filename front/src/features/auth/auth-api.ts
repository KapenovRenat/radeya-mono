import type { AuthResponse, LoginRequest } from "@radeya/shared";

import { baseApi } from "@/shared/api/base-api";

/**
 * Вход в дашборд.
 *
 * Токена здесь нет и быть не может: сервер ставит httpOnly-куку, браузер
 * прикладывает её сам. Ничего сохранять в localStorage не нужно — оттуда
 * значение можно украсть скриптом, из httpOnly-куки нельзя.
 *
 * Тег "Auth" связывает три эндпоинта: после login и logout запрос me
 * перезапрашивается автоматически, вручную состояние обновлять не надо.
 */
export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<AuthResponse, LoginRequest>({
      query: (body) => ({
        url: "/auth/login",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Auth"],
    }),

    logout: build.mutation<void, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
      }),
      invalidatesTags: ["Auth"],
    }),

    getMe: build.query<AuthResponse, void>({
      query: () => "/auth/me",
      providesTags: ["Auth"],
    }),
  }),
});

export const { useLoginMutation, useLogoutMutation, useGetMeQuery } = authApi;
