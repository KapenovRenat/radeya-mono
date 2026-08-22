"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { normalizeLogin } from "@radeya/shared";

import { apiErrorMessage } from "@/shared/api/error-message";
import { useLoginMutation } from "./auth-api";

/**
 * Состояние и отправка формы входа. Вся логика здесь, в разметке остаётся
 * только подстановка значений — так вёрстку можно переделывать, не трогая логику.
 */
export function useLoginForm() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitLogin, { isLoading }] = useLoginMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Без этого браузер отправит форму сам и перезагрузит страницу.
    event.preventDefault();
    setError(null);

    try {
      await submitLogin({
        // Тем же правилом, что и на сервере: Ivan и ivan — один логин.
        login: normalizeLogin(login),
        password,
      }).unwrap();

      // replace, а не push: кнопка «назад» не должна возвращать на форму входа.
      router.replace("/dashboard");
    } catch (requestError) {
      // Сервер намеренно не уточняет, что именно не подошло, — не уточняем и мы.
      setError(apiErrorMessage(requestError, "Неверный логин или пароль"));
    }
  }

  return {
    login,
    setLogin,
    password,
    setPassword,
    error,
    isLoading,
    handleSubmit,
  };
}
