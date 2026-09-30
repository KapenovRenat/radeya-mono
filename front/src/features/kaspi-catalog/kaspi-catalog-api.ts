import type {
  KaspiCabinetFetchRequest,
  KaspiCabinetFetchResponse,
  KaspiCatalogPreview,
  KaspiCatalogPreviewRequest,
} from "@radeya/shared";

import { baseApi } from "@/shared/api/base-api";

/**
 * Предпросмотр каталога Kaspi. Мутация, а не запрос: сервер ничего не хранит,
 * результат считается заново на каждую отправку файлов.
 *
 * Тег кэша не нужен — инвалидировать нечего.
 */
export const kaspiCatalogApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    previewKaspiCatalog: build.mutation<
      KaspiCatalogPreview,
      KaspiCatalogPreviewRequest
    >({
      query: (body) => ({
        url: "/kaspi-catalog/preview",
        method: "POST",
        body,
      }),
    }),

    /**
     * Обход каталога в кабинете Kaspi — по ручной куке или по сессии входа.
     *
     * Сбрасывает `KaspiCabinet`: обход мог войти заново или упереться в неверный
     * пароль, и статус входа на странице должен это показать.
     */
    fetchKaspiCabinet: build.mutation<
      KaspiCabinetFetchResponse,
      KaspiCabinetFetchRequest
    >({
      query: (body) => ({
        url: "/kaspi-catalog/fetch",
        method: "POST",
        body,
      }),
      invalidatesTags: ["KaspiCabinet"],
    }),
  }),
});

export const { usePreviewKaspiCatalogMutation, useFetchKaspiCabinetMutation } =
  kaspiCatalogApi;
