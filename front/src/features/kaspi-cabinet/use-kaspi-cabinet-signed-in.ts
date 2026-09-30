"use client";

import { KASPI_LOGIN_STATUSES } from "@radeya/shared";

import { useGetKaspiCabinetAccountQuery } from "./kaspi-cabinet-api";

/**
 * Работает ли вход в кабинет Kaspi по email и паролю.
 *
 * «Да» — данные сохранены и последний вход прошёл. Жива ли сессия прямо сейчас,
 * не важно: умерла — сервер войдёт сам. После сохранения нового пароля статус
 * пустой, и это «нет», пока вход не проверят в «Настройках».
 *
 * `isLoading` отдельно: пока статус не пришёл, страница не должна показать
 * ручную куку, а через мгновение её спрятать.
 */
export function useKaspiCabinetSignedIn() {
  const { data, isLoading } = useGetKaspiCabinetAccountQuery();

  return {
    signedIn: data?.configured === true && data.status === KASPI_LOGIN_STATUSES.OK,
    isLoading,
  };
}
