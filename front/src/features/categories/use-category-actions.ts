"use client";

import { useCallback, useRef, useState } from "react";
import { ALL_PRODUCTS_LABEL, CATEGORY_NAME_MAX_LENGTH, type CategoryDto } from "@radeya/shared";
import { apiErrorMessage } from "@/shared/api/error-message";
import { useDeleteCategoryMutation, useRenameCategoryMutation } from "./categories-api";

type CategoryAction = { mode: "rename" | "delete"; category: CategoryDto };

export function useCategoryActions(onDeleted: (category: CategoryDto) => void) {
  const [action, setAction] = useState<CategoryAction | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const [renameCategory, renameState] = useRenameCategoryMutation();
  const [deleteCategory, deleteState] = useDeleteCategoryMutation();
  const open = useCallback((mode: CategoryAction["mode"], category: CategoryDto) => {
    if (busy.current) return;
    setAction({ mode, category });
    setName(category.name);
    setError(null);
  }, []);
  const close = useCallback(() => {
    if (!busy.current) setAction(null);
  }, []);
  const submit = useCallback(async () => {
    if (!action || busy.current) return;
    const trimmed = name.trim();
    if (action.mode === "rename" && (!trimmed || trimmed.length > CATEGORY_NAME_MAX_LENGTH
      || trimmed.toLowerCase() === ALL_PRODUCTS_LABEL.toLowerCase())) {
      setError("Введите допустимое название категории (до " + CATEGORY_NAME_MAX_LENGTH + " символов)");
      return;
    }
    busy.current = true;
    setError(null);
    try {
      if (action.mode === "rename") {
        await renameCategory({ id: action.category.id, body: { name: trimmed } }).unwrap();
      } else {
        await deleteCategory(action.category.id).unwrap();
        onDeleted(action.category);
      }
      setAction(null);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Не удалось изменить категорию"));
    } finally {
      busy.current = false;
    }
  }, [action, name, renameCategory, deleteCategory, onDeleted]);

  return { action, name, setName, error, open, close, submit,
    isSaving: renameState.isLoading || deleteState.isLoading };
}
