"use client";

import { useEffect, useRef } from "react";
import { USER_ROLES, USER_ROLE_LABELS, type UserRole } from "@radeya/shared";

import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { useCreateUserForm } from "@/features/users/use-create-user-form";

interface CreateUserDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Модалка создания сотрудника.
 *
 * Взят нативный <dialog>: он сам даёт ловушку фокуса, закрытие по Escape
 * и подложку. Своя реализация на div потребовала бы всего этого руками,
 * и обычно про клавиатуру в ней забывают.
 */
export function CreateUserDialog({ open, onClose }: CreateUserDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { values, setField, reset, error, fieldErrors, isLoading, handleSubmit } =
    useCreateUserForm(onClose);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      // Escape закрывает окно мимо React — состояние надо синхронизировать.
      onClose={() => {
        reset();
        onClose();
      }}
      className="w-full max-w-sm rounded-lg border bg-background p-6 text-foreground backdrop:bg-black/50"
    >
      <h2 className="mb-4 text-lg font-semibold">Новый аккаунт</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          label="Имя"
          value={values.name}
          error={fieldErrors.name}
          onChange={(event) => setField("name", event.target.value)}
          autoComplete="off"
        />

        <Input
          label="Логин"
          value={values.login}
          error={fieldErrors.login}
          onChange={(event) => setField("login", event.target.value)}
          autoComplete="off"
        />

        <Input
          label="Пароль"
          type="password"
          value={values.password}
          error={fieldErrors.password}
          onChange={(event) => setField("password", event.target.value)}
          autoComplete="new-password"
        />

        <label className="flex flex-col gap-1 text-sm">
          Роль
          <select
            value={values.role}
            onChange={(event) => setField("role", event.target.value as UserRole)}
            className="h-11 rounded-lg border border-input bg-background px-3"
          >
            {Object.values(USER_ROLES).map((role) => (
              <option key={role} value={role}>
                {USER_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </label>

        <Input
          label="Должность"
          value={values.position}
          error={fieldErrors.position}
          onChange={(event) => setField("position", event.target.value)}
          autoComplete="off"
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="mt-2 flex gap-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Создаю…" : "Создать"}
          </Button>

          <Button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Отмена
          </Button>
        </div>
      </form>
    </dialog>
  );
}
