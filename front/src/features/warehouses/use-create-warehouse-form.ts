"use client";

import { useCallback, useRef, useState } from "react";
import {
  WAREHOUSE_KASPI_CODE_PATTERN,
  WAREHOUSE_NAME_MAX_LENGTH,
  WAREHOUSE_OWN_CODE_PATTERN,
} from "@radeya/shared";

import { apiErrorMessage } from "@/shared/api/error-message";
import { useCreateWarehouseMutation } from "./warehouses-api";

/**
 * Форма нашего склада без Kaspi: код и название. Проверка та же, что на сервере;
 * сервер всё равно проверит сам и ответит 409 на занятый код.
 */
export function useCreateWarehouseForm() {
  const [createWarehouse, { isLoading }] = useCreateWarehouseMutation();
  const saving = useRef(false);
  const [code, setCodeValue] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  /** Код — заглавными сразу: `ncity` и `NCITY` не должны выглядеть разными. */
  const setCode = useCallback((value: string) => setCodeValue(value.toUpperCase().trim()), []);

  const submit = useCallback(async () => {
    if (saving.current) return;

    const trimmedName = name.trim();

    if (!WAREHOUSE_OWN_CODE_PATTERN.test(code)) {
      setError("Код — латиница и цифры, от 2 до 16 знаков, первая — буква");

      return;
    }

    if (WAREHOUSE_KASPI_CODE_PATTERN.test(code)) {
      setError("Коды вида PP3 заняты складами Kaspi");

      return;
    }

    if (trimmedName === "" || trimmedName.length > WAREHOUSE_NAME_MAX_LENGTH) {
      setError("Введите название до " + WAREHOUSE_NAME_MAX_LENGTH + " символов");

      return;
    }

    saving.current = true;
    setError(null);
    setCreated(null);

    try {
      const warehouse = await createWarehouse({ code, name: trimmedName }).unwrap();

      setCodeValue("");
      setName("");
      setCreated(warehouse.code);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Не удалось создать склад"));
    } finally {
      saving.current = false;
    }
  }, [code, createWarehouse, name]);

  return { code, setCode, name, setName, submit, isSaving: isLoading, error, created };
}
