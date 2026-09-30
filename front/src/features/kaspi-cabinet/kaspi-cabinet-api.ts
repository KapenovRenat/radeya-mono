import type {
  KaspiCabinetAccountDto,
  KaspiCabinetCheckResponse,
  SaveKaspiCabinetAccountRequest,
} from "@radeya/shared";

import { baseApi } from "@/shared/api/base-api";

export const kaspiCabinetApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** Email и состояние входа. Пароля в ответе нет никогда. */
    getKaspiCabinetAccount: build.query<KaspiCabinetAccountDto, void>({
      query: () => ({ url: "/kaspi-cabinet/account" }),
      providesTags: ["KaspiCabinet"],
    }),

    /** Сохранить email и пароль. Сервер при этом не входит — только хранит. */
    saveKaspiCabinetAccount: build.mutation<
      KaspiCabinetAccountDto,
      SaveKaspiCabinetAccountRequest
    >({
      query: (body) => ({ url: "/kaspi-cabinet/account", method: "PUT", body }),
      invalidatesTags: ["KaspiCabinet", "Audit"],
    }),

    /**
     * Проверка подключения: жива сессия — входа нет, иначе сервер входит.
     * Ответ несёт трассу запросов к Kaspi — для консоли браузера.
     */
    checkKaspiCabinet: build.mutation<KaspiCabinetCheckResponse, void>({
      query: () => ({ url: "/kaspi-cabinet/check", method: "POST" }),
      invalidatesTags: ["KaspiCabinet", "Audit"],
    }),
  }),
});

export const {
  useGetKaspiCabinetAccountQuery,
  useSaveKaspiCabinetAccountMutation,
  useCheckKaspiCabinetMutation,
} = kaspiCabinetApi;
