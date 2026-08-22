"use client";

import { useCallback, useState, type FormEvent } from "react";
import { USER_ROLES, normalizeLogin, type UserRole } from "@radeya/shared";

import { apiErrorMessage, apiFieldErrors } from "@/shared/api/error-message";
import { useCreateUserMutation } from "./users-api";

export interface CreateUserFormValues {
  name: string;
  login: string;
  password: string;
  role: UserRole;
  position: string;
}

const EMPTY_FORM: CreateUserFormValues = {
  name: "",
  login: "",
  password: "",
  // Роль по умолчанию — самая безобидная. Забыли выбрать — сотрудник получит
  // минимум прав, а не полный доступ.
  role: USER_ROLES.SELLER,
  position: "",
};

/**
 * Форма создания сотрудника.
 *
 * `onSuccess` вызывается после успешного создания — в нём модалку и закрывают.
 * Таблица обновляется сама: мутация помечает тег "User", список перезапрашивается.
 */
export function useCreateUserForm(onSuccess: () => void) {
  const [values, setValues] = useState<CreateUserFormValues>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [createUser, { isLoading }] = useCreateUserMutation();

  const setField = useCallback(
    <K extends keyof CreateUserFormValues>(
      field: K,
      value: CreateUserFormValues[K],
    ) => {
      setValues((current) => ({ ...current, [field]: value }));
      // Ошибку поля снимаем сразу при правке — держать её до отправки незачем.
      setFieldErrors((current) => {
        if (!current[field]) return current;
        const next = { ...current };
        delete next[field];
        return next;
      });
    },
    [],
  );

  const reset = useCallback(() => {
    setValues(EMPTY_FORM);
    setError(null);
    setFieldErrors({});
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    try {
      await createUser({
        ...values,
        login: normalizeLogin(values.login),
        name: values.name.trim(),
        position: values.position.trim(),
      }).unwrap();

      reset();
      onSuccess();
    } catch (requestError) {
      setFieldErrors(apiFieldErrors(requestError));
      setError(apiErrorMessage(requestError, "Не удалось создать аккаунт"));
    }
  }

  return { values, setField, reset, error, fieldErrors, isLoading, handleSubmit };
}
