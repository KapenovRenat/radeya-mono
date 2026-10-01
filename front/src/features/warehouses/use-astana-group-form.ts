"use client";

import { useCallback, useRef, useState } from "react";
import { ASTANA_STOCK_WAREHOUSE_CODE, TELEGRAM_CHAT_ID_PATTERN } from "@radeya/shared";

import { apiErrorMessage } from "@/shared/api/error-message";
import { useGetWarehousesQuery, useUpdateWarehouseMutation } from "./warehouses-api";

/**
 * Поле «Из наличия в Астане»: Telegram-группа кладовщика склада Астаны.
 * Сюда воркер шлёт заказы в наличии с этого склада, остальное — поставщикам.
 *
 * Черновик `null` — показываем сохранённое; правка не затирается
 * перезапросом справочника.
 */
export function useAstanaGroupForm() {
  const warehouses = useGetWarehousesQuery();
  const [updateWarehouse, { isLoading }] = useUpdateWarehouseMutation();
  const saving = useRef(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const warehouse = warehouses.data?.items.find((item) => item.code === ASTANA_STOCK_WAREHOUSE_CODE) ?? null;
  const saved = warehouse?.telegramChatId ?? "";
  const value = draft ?? saved;

  const setValue = useCallback((next: string) => {
    setNotice(null);
    setDraft(next);
  }, []);

  const save = useCallback(async () => {
    if (saving.current || warehouse === null) return;

    const trimmed = value.trim();

    if (trimmed !== "" && !TELEGRAM_CHAT_ID_PATTERN.test(trimmed)) {
      setError("Telegram ID — только цифры, у группы с минусом");

      return;
    }

    saving.current = true;
    setError(null);

    try {
      await updateWarehouse({ id: warehouse.id, telegramChatId: trimmed === "" ? null : trimmed }).unwrap();
      setDraft(null);
      setNotice("Сохранено");
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Не удалось сохранить Telegram ID группы"));
    } finally {
      saving.current = false;
    }
  }, [updateWarehouse, value, warehouse]);

  return {
    warehouse,
    isLoading: warehouses.isLoading,
    value,
    setValue,
    isDirty: draft !== null && draft.trim() !== saved,
    save,
    isSaving: isLoading,
    error,
    notice,
  };
}
