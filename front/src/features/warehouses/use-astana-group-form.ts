"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ASTANA_STOCK_WAREHOUSE_CODE,
  TELEGRAM_CHAT_ID_PATTERN,
  WAREHOUSE_TELEGRAM_GROUP_FIELDS,
  type UpdateWarehouseRequest,
  type WarehouseTelegramGroupField,
} from "@radeya/shared";

import { apiErrorMessage } from "@/shared/api/error-message";
import { useGetWarehousesQuery, useUpdateWarehouseMutation } from "./warehouses-api";

type GroupsDraft = Record<WarehouseTelegramGroupField, string>;

const GROUP_FIELDS = Object.values(WAREHOUSE_TELEGRAM_GROUP_FIELDS);

/**
 * Три Telegram-группы склада Астаны: отгрузки на Zammler, своя доставка,
 * самовывоз. Сюда воркер шлёт заказы в наличии с этого склада по виду доставки,
 * остальное — поставщикам. Одна кнопка «Сохранить» на все три поля.
 *
 * Черновик `null` — показываем сохранённое; правка не затирается
 * перезапросом справочника.
 */
export function useAstanaGroupForm() {
  const warehouses = useGetWarehousesQuery();
  const [updateWarehouse, { isLoading }] = useUpdateWarehouseMutation();
  const saving = useRef(false);
  const [draft, setDraft] = useState<GroupsDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const warehouse = warehouses.data?.items.find((item) => item.code === ASTANA_STOCK_WAREHOUSE_CODE) ?? null;
  const saved = useMemo<GroupsDraft>(() => ({
    kaspiDeliveryChatId: warehouse?.kaspiDeliveryChatId ?? "",
    ownDeliveryChatId: warehouse?.ownDeliveryChatId ?? "",
    pickupChatId: warehouse?.pickupChatId ?? "",
  }), [warehouse]);
  const value = draft ?? saved;
  const isDirty = draft !== null && GROUP_FIELDS.some((field) => draft[field].trim() !== saved[field]);

  const setValue = useCallback((field: WarehouseTelegramGroupField, next: string) => {
    setNotice(null);
    setDraft((current) => ({ ...(current ?? saved), [field]: next }));
  }, [saved]);

  const save = useCallback(async () => {
    if (saving.current || warehouse === null) return;

    const body = {} as UpdateWarehouseRequest;

    for (const field of GROUP_FIELDS) {
      const trimmed = value[field].trim();

      if (trimmed !== "" && !TELEGRAM_CHAT_ID_PATTERN.test(trimmed)) {
        setError("Telegram ID — только цифры, у группы с минусом");

        return;
      }

      body[field] = trimmed === "" ? null : trimmed;
    }

    saving.current = true;
    setError(null);

    try {
      await updateWarehouse({ id: warehouse.id, ...body }).unwrap();
      setDraft(null);
      setNotice("Сохранено");
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Не удалось сохранить Telegram ID групп"));
    } finally {
      saving.current = false;
    }
  }, [updateWarehouse, value, warehouse]);

  return {
    warehouse,
    isLoading: warehouses.isLoading,
    value,
    setValue,
    isDirty,
    save,
    isSaving: isLoading,
    error,
    notice,
  };
}
