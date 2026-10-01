"use client";

import { useCallback, useRef, useState } from "react";
import {
  TELEGRAM_CHAT_ID_PATTERN,
  type SendTestCardResponse,
  type TestCardKind,
} from "@radeya/shared";

import { apiErrorMessage } from "@/shared/api/error-message";
import { useSendTestCardMutation } from "./workers-api";

/**
 * Тестовая карточка: выдуманный заказ с диваном из каталога — на один ID или
 * всем, у кого есть Telegram ID (группа Астаны, поставщики). Проверяет бота,
 * шрифты, фото и доступ к каждому чату — не дожидаясь живого заказа.
 * Итог — по каждому получателю, с ответом Telegram при отказе.
 *
 * `defaultChatId` — Telegram ID разработчика из настроек, пока поле не трогали.
 */
export function useTestCard(defaultChatId: string | null) {
  const [sendTestCard, { isLoading }] = useSendTestCardMutation();
  const sending = useRef(false);
  const [chatDraft, setChatDraft] = useState<string | null>(null);
  const [kind, setKind] = useState<TestCardKind>("NEW");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendTestCardResponse | null>(null);

  const chatId = chatDraft ?? defaultChatId ?? "";

  const send = useCallback(async (target: "ONE" | "ALL") => {
    if (sending.current) return;

    const trimmed = chatId.trim();

    if (trimmed !== "" && !TELEGRAM_CHAT_ID_PATTERN.test(trimmed)) {
      setError("Telegram ID — только цифры, у группы с минусом");

      return;
    }

    if (target === "ONE" && trimmed === "") {
      setError("Укажите Telegram ID, кому отправить");

      return;
    }

    // Всем — значит и поставщикам: живые люди получат сообщение. Без вопроса нельзя.
    if (target === "ALL" && !window.confirm(
      "Тестовая карточка уйдёт всем с Telegram ID: группе Астаны и всем поставщикам. "
      + "На ней будет плашка «ТЕСТ — НЕ ЗАКАЗ». Отправить?",
    )) return;

    sending.current = true;
    setError(null);
    setResult(null);

    try {
      setResult(await sendTestCard({ target, chatId: trimmed === "" ? null : trimmed, kind }).unwrap());
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Тестовая карточка не ушла"));
    } finally {
      sending.current = false;
    }
  }, [chatId, kind, sendTestCard]);

  return { chatId, setChatId: setChatDraft, kind, setKind, send, isSending: isLoading, error, result };
}
