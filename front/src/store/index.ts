import { configureStore } from "@reduxjs/toolkit";

import { baseApi } from "@/shared/api/base-api";

/**
 * Стор собирается фабрикой, а не создаётся на уровне модуля:
 * при серверном рендере на каждый запрос нужен свой экземпляр.
 *
 * Слайсы клиентского состояния (корзина, фильтры, UI) добавляются в reducer,
 * серверные данные живут в RTK Query и вручную не дублируются.
 */
export const makeStore = () =>
  configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(baseApi.middleware),
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
