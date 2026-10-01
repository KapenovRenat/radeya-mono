"use client";

import { useCallback, useRef, useState } from "react";
import {
  SUPPLIER_TELEGRAM_ID_MAX_LENGTH,
  TELEGRAM_CHAT_ID_PATTERN,
  type SupplierDto,
} from "@radeya/shared";

import { apiErrorMessage } from "@/shared/api/error-message";
import { useUpdateSupplierMutation } from "./suppliers-api";

/**
 * Окно поставщика в настройках: данные для сверки и поле Telegram ID.
 * По этому ID воркер шлёт поставщику заказы, отмены и возвраты.
 */
export function useSupplierTelegramForm(suppliers: SupplierDto[]) {
  const [updateSupplier, { isLoading }] = useUpdateSupplierMutation();
  const saving = useRef(false);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [telegramId, setTelegramId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const supplier = suppliers.find((item) => item.id === supplierId) ?? null;

  const open = useCallback((id: string) => {
    if (saving.current) return;

    setSupplierId(id);
    setTelegramId(suppliers.find((item) => item.id === id)?.telegramId ?? "");
    setError(null);
    setIsOpen(true);
  }, [suppliers]);

  const close = useCallback(() => {
    if (!saving.current) setIsOpen(false);
  }, []);

  const save = useCallback(async () => {
    if (saving.current || supplier === null) return;

    const value = telegramId.trim();

    if (value.length > SUPPLIER_TELEGRAM_ID_MAX_LENGTH
      || (value !== "" && !TELEGRAM_CHAT_ID_PATTERN.test(value))) {
      setError("Telegram ID — только цифры, у группы с минусом");

      return;
    }

    saving.current = true;
    setError(null);

    try {
      // Пустое поле — снять Telegram: поставщику перестанут уходить уведомления.
      await updateSupplier({ id: supplier.id, telegramId: value === "" ? null : value }).unwrap();
      setIsOpen(false);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Не удалось сохранить Telegram ID"));
    } finally {
      saving.current = false;
    }
  }, [supplier, telegramId, updateSupplier]);

  return { supplier, isOpen, open, close, telegramId, setTelegramId, save, isSaving: isLoading, error };
}
