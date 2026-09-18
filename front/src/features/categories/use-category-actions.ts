"use client";

import { useCallback, useRef, useState } from "react";
import { ALL_PRODUCTS_LABEL, CATEGORY_NAME_MAX_LENGTH, type CategoryDto } from "@radeya/shared";
import { apiErrorMessage } from "@/shared/api/error-message";
import { useDeleteCategoryMutation, useGetCategoryTreeQuery, useRenameCategoryMutation,
  useReorderCategoriesMutation } from "./categories-api";

type CategoryAction = { mode: "rename" | "delete"; category: CategoryDto };

export function useCategoryActions(onDeleted: (category: CategoryDto) => void) {
  const [action, setAction] = useState<CategoryAction | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const busy = useRef(false);
  const [renameCategory, renameState] = useRenameCategoryMutation();
  const [deleteCategory, deleteState] = useDeleteCategoryMutation();
  const [reorderCategories, reorderState] = useReorderCategoriesMutation();
  // Своё обращение к дереву, а не список из страницы: там дерево может быть
  // отфильтровано поиском, а серверу нужен полный порядок уровня. Запрос
  // лишним не будет — это то же попадание в кэш RTK Query.
  const tree = useGetCategoryTreeQuery();
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

  /** Перестановка внутри своего уровня: соседние позиции меняются местами. */
  const move = useCallback(async (category: CategoryDto, direction: "up" | "down") => {
    if (busy.current) return;

    const items = tree.data?.items ?? [];
    const level = category.parentId === null
      ? items
      : items.find((item) => item.id === category.parentId)?.children ?? [];
    const ids = level.map((item) => item.id);
    const from = ids.indexOf(category.id);
    const to = direction === "up" ? from - 1 : from + 1;
    if (from === -1 || to < 0 || to >= ids.length) return;

    const moved = ids[from];
    const neighbour = ids[to];
    if (moved === undefined || neighbour === undefined) return;
    ids[from] = neighbour;
    ids[to] = moved;

    busy.current = true;
    setMoveError(null);
    try {
      await reorderCategories({ parentId: category.parentId, ids }).unwrap();
    } catch (requestError) {
      setMoveError(apiErrorMessage(requestError, "Не удалось изменить порядок категорий"));
    } finally {
      busy.current = false;
    }
  }, [tree.data, reorderCategories]);

  return { action, name, setName, error, open, close, submit, move, moveError,
    isSaving: renameState.isLoading || deleteState.isLoading || reorderState.isLoading };
}
