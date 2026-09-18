import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

/**
 * Единая точка доступа к API. Модули дописывают свои эндпоинты
 * через injectEndpoints — второй createApi заводить не нужно.
 *
 * credentials: "include" — чтобы браузер отправлял куку сессии на другой порт.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: API_URL,
    credentials: "include",
  }),
  // Теги нужны для инвалидации кэша: мутация помечает тег, списки перезапрашиваются сами.
  tagTypes: [
    "Health",
    "Auth",
    "User",
    "Audit",
    "Product",
    "Category",
    "Supplier",
    "Order",
    "Warehouse",
  ],
  endpoints: () => ({}),
});
