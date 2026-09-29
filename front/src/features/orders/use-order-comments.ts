"use client";

import { useCallback, useRef, useState } from "react";
import { ORDER_COMMENT_MAX_LENGTH } from "@radeya/shared";

import { apiErrorMessage } from "@/shared/api/error-message";
import { useAddOrderCommentMutation, useGetOrderCommentsQuery } from "./orders-api";

/**
 * Лента комментариев заказа и поле «добавить».
 *
 * Автор не передаётся — сервер берёт его из сессии. Правок и удалений нет:
 * комментарий, который можно подтереть, не отвечает на вопрос «кто это решил».
 */
export function useOrderComments(orderId: string) {
  const comments = useGetOrderCommentsQuery(orderId);
  const [addComment, { isLoading: isSending }] = useAddOrderCommentMutation();
  const [text, setTextValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Защита от двойной отправки: Enter и клик подряд дали бы два одинаковых комментария.
  const sending = useRef(false);

  const setText = useCallback((value: string) => {
    setTextValue(value.slice(0, ORDER_COMMENT_MAX_LENGTH));
    setError(null);
  }, []);

  const send = useCallback(async () => {
    const trimmed = text.trim();

    if (sending.current || trimmed === "") return;

    sending.current = true;
    setError(null);

    try {
      await addComment({ orderId, text: trimmed }).unwrap();
      setTextValue("");
    } catch (requestError) {
      // Текст не стираем: человек его набирал, пусть отправит ещё раз.
      setError(apiErrorMessage(requestError, "Не удалось добавить комментарий"));
    } finally {
      sending.current = false;
    }
  }, [addComment, orderId, text]);

  return {
    items: comments.data?.items ?? [],
    isLoading: comments.isLoading,
    loadError: comments.isError
      ? apiErrorMessage(comments.error, "Не удалось загрузить комментарии")
      : null,
    text, setText, send, isSending, error,
    maxLength: ORDER_COMMENT_MAX_LENGTH,
  };
}
