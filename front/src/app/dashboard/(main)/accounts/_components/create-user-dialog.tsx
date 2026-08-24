"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
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
    useCreateUserForm(() => dialogRef.current?.close());

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      /**
       * Все способы закрытия сходятся сюда: Escape, крестик, «Отмена», клик
       * по подложке и успешное создание. Каждый из них просто зовёт close(),
       * а очистка формы и уведомление родителя описаны один раз.
       */
      onClose={() => {
        reset();
        onClose();
      }}
      /**
       * Клик по подложке. У нативного диалога подложка — не отдельный элемент,
       * клик по ней приходит на сам <dialog>. Поэтому у диалога нет внутренних
       * отступов: иначе клик по его полям тоже считался бы кликом мимо окна.
       */
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          dialogRef.current?.close();
        }
      }}
      className="m-auto w-full max-w-sm rounded-lg border bg-background p-0 text-foreground backdrop:bg-black/50"
    >
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Новый аккаунт</h2>

          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Закрыть"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

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
              onChange={(event) =>
                setField("role", event.target.value as UserRole)
              }
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

            <Button type="button" onClick={() => dialogRef.current?.close()}>
              Отмена
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
