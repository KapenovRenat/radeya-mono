import type { CreateDictionaryItemRequest, DictionariesResponse, DictionaryItemDto,
  DictionaryKind, UpdateDictionaryItemRequest } from "@radeya/shared";

import { baseApi } from "@/shared/api/base-api";

export const dictionariesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Значения списков. Без `kind` — все четыре разом.
     *
     * В форме заказа нужны сразу все, и четыре запроса вместо одного ничего
     * не экономят: строк там несколько десятков.
     */
    getDictionaries: build.query<DictionariesResponse, DictionaryKind | void>({
      query: (kind) => ({ url: "/dictionaries", params: kind ? { kind } : {} }),
      providesTags: ["Dictionary"],
    }),

    addDictionaryItem: build.mutation<DictionaryItemDto, CreateDictionaryItemRequest>({
      query: (body) => ({ url: "/dictionaries", method: "POST", body }),
      invalidatesTags: ["Dictionary", "Audit"],
    }),

    /**
     * Переименование и закрытие.
     *
     * Сбрасывается и `Order`: значение справочника видно в карточке заказа,
     * и после переименования там обязано появиться новое.
     */
    updateDictionaryItem: build.mutation<
      DictionaryItemDto,
      UpdateDictionaryItemRequest & { id: string }
    >({
      query: ({ id, ...body }) => ({ url: `/dictionaries/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Dictionary", "Order", "Audit"],
    }),
  }),
});

export const { useGetDictionariesQuery, useAddDictionaryItemMutation,
  useUpdateDictionaryItemMutation } = dictionariesApi;
