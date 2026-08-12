"use client";

import { useRef, type ReactNode } from "react";
import { Provider } from "react-redux";

import { makeStore, type AppStore } from "@/store";

/**
 * Провайдеры клиентской части. Стор создаётся один раз на клиент —
 * не на модуле, иначе при серверном рендере состояние одного пользователя
 * утекло бы к другому.
 */
export function Providers({ children }: { children: ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);

  if (storeRef.current === null) {
    storeRef.current = makeStore();
  }

  return <Provider store={storeRef.current}>{children}</Provider>;
}
