"use client";

import { useCallback, useRef, useState } from "react";
import { ALL_PRODUCTS_LABEL, CATEGORY_NAME_MAX_LENGTH, type CategoryDto } from "@radeya/shared";
import { apiErrorMessage } from "@/shared/api/error-message";
import { useCreateCategoryMutation } from "./categories-api";

/** open(null) — корневая папка; open(id) — подпапка. Родитель фиксируется при открытии. */
export function useCreateCategoryForm(onCreated?: (category: CategoryDto) => void) {
  const [createCategory, { isLoading }] = useCreateCategoryMutation();
  const saving = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback((parent: string | null) => {
    if (saving.current) return;
    setParentId(parent);
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
    if (!trimmed || trimmed.length > CATEGORY_NAME_MAX_LENGTH) {
      setError("Введите название от 1 до " + CATEGORY_NAME_MAX_LENGTH + " символов");
      return null;
    }
    if (trimmed.toLowerCase() === ALL_PRODUCTS_LABEL.toLowerCase()) {
      setError("Это имя зарезервировано для всего каталога");
      return null;
    }
    saving.current = true;
    setError(null);
    try {
      const category = await createCategory({ name: trimmed, parentId }).unwrap();
      setIsOpen(false);
      onCreated?.(category);
      return category;
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Не удалось создать категорию"));
      return null;
    } finally {
      saving.current = false;
    }
  }, [createCategory, name, parentId, onCreated]);

  return { isOpen, open, close, name, setName, parentId, submit, isSaving: isLoading, error };
}
