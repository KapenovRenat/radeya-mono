"use client";

import { useId } from "react";
import {
  KASPI_CABINET_EMAIL_MAX_LENGTH,
  KASPI_CABINET_PASSWORD_MAX_LENGTH,
  KASPI_LOGIN_STATUS_LABELS,
} from "@radeya/shared";

import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { useKaspiCabinetSettings } from "@/features/kaspi-cabinet/use-kaspi-cabinet-settings";
import { formatDateTime } from "@/lib/format";

/**
 * Доступ в кабинет Kaspi: email, пароль, сохранение и проверка подключения.
 *
 * Разметка минимальная, на общих компонентах — внешний вид дорабатывается
 * отдельно. Ответы Kaspi при проверке печатаются в консоль браузера.
 */
export function KaspiCabinetBlock() {
  const settings = useKaspiCabinetSettings();
  const { account, checkResult } = settings;
  const formId = useId();
  const busy = settings.isSaving || settings.isChecking;

  return (
    <section className="space-y-4" aria-labelledby={formId + "-title"}>
      <h2 id={formId + "-title"} className="text-lg font-semibold">
        Кабинет Kaspi
      </h2>

      <p className="text-sm">
        Email и пароль от кабинета продавца. Сервер входит сам и только когда
        кабинет понадобился — например, за данными заказа, которых нет в API.
        Пароль хранится зашифрованным и обратно не показывается.
      </p>

      {settings.loadError && <p role="alert" className="text-sm text-destructive">{settings.loadError}</p>}

      {account?.configured && (
        <dl className="text-sm">
          <div>
            <dt className="inline">Последний вход: </dt>
            <dd className="inline">
              {account.status ? KASPI_LOGIN_STATUS_LABELS[account.status] : "ещё не было"}
              {account.lastAttemptAt ? `, ${formatDateTime(account.lastAttemptAt)}` : ""}
            </dd>
          </div>

          <div>
            <dt className="inline">Сессия: </dt>
            <dd className="inline">{account.hasSession ? "сохранена" : "нет — войдём при первом запросе"}</dd>
          </div>

          {account.lastError && (
            <div>
              <dt className="inline">Ошибка: </dt>
              <dd className="inline">{account.lastError}</dd>
            </div>
          )}

          {account.blockedUntil && (
            <div>
              <dt className="inline">Kaspi не даёт входить до: </dt>
              <dd className="inline">{formatDateTime(account.blockedUntil)}</dd>
            </div>
          )}
        </dl>
      )}

      <form
        id={formId}
        className="max-w-md space-y-3"
        onSubmit={(event) => {
          // Иначе браузер отправит форму сам и перезагрузит страницу.
          event.preventDefault();
          void settings.save();
        }}
      >
        <Input
          id={formId + "-email"}
          label="Email"
          type="email"
          value={settings.email}
          onChange={(event) => settings.setEmail(event.target.value)}
          maxLength={KASPI_CABINET_EMAIL_MAX_LENGTH}
          // Не даём браузеру запомнить эту пару как вход в нашу админку.
          autoComplete="off"
          disabled={busy}
        />

        <Input
          id={formId + "-password"}
          label="Пароль"
          type="password"
          value={settings.password}
          onChange={(event) => settings.setPassword(event.target.value)}
          maxLength={KASPI_CABINET_PASSWORD_MAX_LENGTH}
          placeholder={account?.configured ? "Сохранён — введите, чтобы сменить" : ""}
          autoComplete="new-password"
          disabled={busy}
        />

        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {settings.isSaving ? "Сохраняю…" : "Сохранить"}
          </Button>

          <Button
            type="button"
            disabled={busy || !account?.configured}
            onClick={() => { void settings.check(); }}
          >
            {settings.isChecking ? "Проверяю…" : "Проверить подключение"}
          </Button>
        </div>
      </form>

      {settings.error && (
        <p role="alert" aria-live="polite" className="text-sm text-destructive">{settings.error}</p>
      )}

      {settings.notice && <p role="status" className="text-sm">{settings.notice}</p>}

      {checkResult && (
        <p role="status" className="text-sm">
          {checkResult.ok ? "Подключение работает" : KASPI_LOGIN_STATUS_LABELS[checkResult.status]}
          {": "}
          {checkResult.message} · запросов к Kaspi: {checkResult.trace.length}, подробности в консоли браузера
        </p>
      )}
    </section>
  );
}
