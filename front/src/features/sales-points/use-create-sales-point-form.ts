"use client";

import { useCallback, useRef, useState } from "react";
import { SALES_POINT_NAME_MAX_LENGTH, type SalesPointDto } from "@radeya/shared";

import { apiErrorMessage } from "@/shared/api/error-message";
import { useCreateSalesPointMutation } from "./sales-points-api";

/**
 * Форма новой офлайн-точки.
 *
 * Поле одно — название. Код и тип не спрашиваются: код генерит сервер, а тип
 * через API всегда офлайновый. Повторная отправка блокируется ref'ом, а не
 * `isLoading`: между кликом и обновлением состояния успевает пройти второй клик.
 */
export function useCreateSalesPointForm(onCreated?: (point: SalesPointDto) => void) {
  const [createSalesPoint, { isLoading }] = useCreateSalesPointMutation();
  const saving = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(() => {
    if (saving.current) return;
    setName("");
    setError(null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    if (!saving.current) setIsOpen(false);
  }, []);

  const submit = useCallback(async () => {
    if (saving.current) return null;

    const trimmed = name.trim();

    if (!trimmed || trimmed.length > SALES_POINT_NAME_MAX_LENGTH) {
      setError("Введите название от 1 до " + SALES_POINT_NAME_MAX_LENGTH + " символов");

      return null;
    }

    saving.current = true;
    setError(null);

    try {
      const point = await createSalesPoint({ name: trimmed }).unwrap();

      setIsOpen(false);
      onCreated?.(point);

      return point;
    } catch (requestError) {
      // Сервер отвечает 409 на дубль названия — текст берём его, он точнее.
      setError(apiErrorMessage(requestError, "Не удалось создать точку продаж"));

      return null;
    } finally {
      saving.current = false;
    }
  }, [createSalesPoint, name, onCreated]);

  return { isOpen, open, close, name, setName, submit, isSaving: isLoading, error };
}
