"use client";

import { useCallback, useRef, useState } from "react";
import {
  KASPI_CABINET_EMAIL_MAX_LENGTH,
  KASPI_CABINET_PASSWORD_MAX_LENGTH,
  type KaspiCabinetCheckResponse,
} from "@radeya/shared";

import { apiErrorMessage } from "@/shared/api/error-message";
import {
  useCheckKaspiCabinetMutation,
  useGetKaspiCabinetAccountQuery,
  useSaveKaspiCabinetAccountMutation,
} from "./kaspi-cabinet-api";

/**
 * Блок «Кабинет Kaspi» в настройках: email, пароль, сохранение и проверка.
 *
 * Пароль с сервера не приходит, поэтому поле всегда пустое и после сохранения
 * очищается. Email подставляется сохранённый, пока его не начали править:
 * черновик `null` значит «показывать то, что на сервере».
 */
export function useKaspiCabinetSettings() {
  const account = useGetKaspiCabinetAccountQuery();
  const [saveAccount, saveState] = useSaveKaspiCabinetAccountMutation();
  const [checkCabinet, checkState] = useCheckKaspiCabinetMutation();

  // Ref, а не isLoading: между кликом и обновлением состояния успевает второй клик,
  // а второй вход в Kaspi подряд — лишний шаг к блокировке.
  const busy = useRef(false);

  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<KaspiCabinetCheckResponse | null>(null);

  const email = emailDraft ?? account.data?.email ?? "";

  const save = useCallback(async () => {
    if (busy.current) return;

    const trimmed = email.trim();

    if (!trimmed || trimmed.length > KASPI_CABINET_EMAIL_MAX_LENGTH) {
      setError("Введите email от кабинета Kaspi");

      return;
    }

    if (!password || password.length > KASPI_CABINET_PASSWORD_MAX_LENGTH) {
      setError("Введите пароль от кабинета Kaspi");

      return;
    }

    busy.current = true;
    setError(null);
    setNotice(null);

    try {
      await saveAccount({ email: trimmed, password }).unwrap();

      setPassword("");
      setEmailDraft(null);
      setCheckResult(null);
      setNotice("Сохранено. Нажмите «Проверить подключение», чтобы убедиться, что Kaspi их принимает");
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Не удалось сохранить данные для входа"));
    } finally {
      busy.current = false;
    }
  }, [email, password, saveAccount]);

  const check = useCallback(async () => {
    if (busy.current) return;

    busy.current = true;
    setError(null);
    setNotice(null);

    try {
      const result = await checkCabinet().unwrap();

      setCheckResult(result);
      logCheck(result);
    } catch (requestError) {
      console.error("Kaspi: проверка подключения не выполнена", requestError);
      setError(apiErrorMessage(requestError, "Не удалось проверить подключение"));
    } finally {
      busy.current = false;
    }
  }, [checkCabinet]);

  return {
    account: account.data ?? null,
    isLoading: account.isLoading,
    loadError: account.error ? apiErrorMessage(account.error, "Не удалось загрузить настройки") : null,
    email,
    setEmail: setEmailDraft,
    password,
    setPassword,
    save,
    isSaving: saveState.isLoading,
    check,
    isChecking: checkState.isLoading,
    checkResult,
    error,
    notice,
  };
}

/**
 * Трасса в консоль: сводная таблица шагов и каждый шаг целиком — в нём тело
 * ответа Kaspi. Куки и ключи входа сервер уже заменил звёздочками.
 */
function logCheck(result: KaspiCabinetCheckResponse) {
  // console.groupCollapsed(`Kaspi: проверка подключения — ${result.status}. ${result.message}`);
  console.table(
    result.trace.map((step) => ({
      шаг: step.label,
      метод: step.method,
      код: step.status,
      адрес: step.url,
      переход: step.location,
      куки: step.cookiesSet.join(", "),
      мс: step.durationMs,
    })),
  );

  for (const step of result.trace) {
    console.log(step.label, step);
  }

  // console.log("Ответ сервера целиком", result);
  console.groupEnd();
}
