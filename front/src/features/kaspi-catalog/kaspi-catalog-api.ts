import type {
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
  }),
});

export const { usePreviewKaspiCatalogMutation } = kaspiCatalogApi;
