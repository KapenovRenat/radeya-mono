"use client";

import { useId, useState } from "react";
import { USER_ROLES, USER_ROLE_LABELS, type UserRole } from "@radeya/shared";

import { Button } from "@/components/button";
import { Dropdown } from "@/components/dropdown";
import { Input } from "@/components/input";
import { Modal } from "@/components/modal";
import type { UserForm } from "@/features/users/use-user-form";
import { PermissionsChecklist } from "./permissions-checklist";
import styles from "./accounts.module.scss";

/**
 * Окно сотрудника: новый или правка — имя, логин (только у нового), пароль,
 * должность, роль-шаблон, галочки прав, удаление.
 *
 * Состояние — в useUserForm у страницы: окно открывается и из кнопки
 * «Добавить», и кликом по строке таблицы.
 */
export function UserDialog({ form }: { form: UserForm }) {
  const formId = useId();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const { values } = form;
  const busy = form.isSaving || form.isDeleting;

  const title = form.isNew ? "Новый аккаунт" : `${form.target?.name} · ${form.target?.login}`;

  return (
    <>
      <Modal
        open={form.isOpen}
        onClose={form.close}
        title={title}
        className={styles.dialog}
        footer={
          <>
            {form.canDelete && (
              <Button type="button" onClick={() => setIsDeleteOpen(true)} disabled={busy} className={styles.deleteButton}>
                Удалить
              </Button>
            )}
            <Button type="button" onClick={form.close} disabled={busy} className="">Отмена</Button>
            {!form.readOnly && (
              <Button type="submit" form={formId} disabled={busy} className="">
                {form.isSaving ? "Сохраняю…" : form.isNew ? "Создать" : "Сохранить"}
              </Button>
            )}
          </>
        }
      >
        <form
          id={formId}
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            void form.submit();
          }}
        >
          {form.readOnly && <p className={styles.note}>Админа может менять только админ.</p>}

          <div className={styles.fields}>
            <Input id={formId + "-name"} label="Имя" value={values.name} error={form.fieldErrors.name}
              onChange={(event) => form.setField("name", event.target.value)}
              disabled={form.readOnly || busy} autoComplete="off" className="" />

            <Input id={formId + "-login"} label="Логин" value={values.login} error={form.fieldErrors.login}
              onChange={(event) => form.setField("login", event.target.value)}
              // Логин не меняется: по нему входят, и он стоит в журнале.
              disabled={!form.isNew || busy} autoComplete="off" className="" />

            <Input id={formId + "-password"} type="password"
              label={form.isNew ? "Пароль" : "Новый пароль"}
              placeholder={form.isNew ? "" : "Пусто — не менять"}
              value={values.password} error={form.fieldErrors.password}
              onChange={(event) => form.setField("password", event.target.value)}
              disabled={form.readOnly || busy} autoComplete="new-password" className="" />

            <Input id={formId + "-position"} label="Должность" value={values.position} error={form.fieldErrors.position}
              onChange={(event) => form.setField("position", event.target.value)}
              disabled={form.readOnly || busy} autoComplete="off" className="" />
          </div>

          <div className={styles.roleRow}>
            <span className={styles.label}>Роль</span>
            <Dropdown
              mode="select"
              label="Роль — шаблон галочек"
              options={form.roleOptions.map((role) => ({ value: role, label: USER_ROLE_LABELS[role] }))}
              value={values.role}
              onChange={(value) => form.setRole(value as UserRole)}
              disabled={form.accessLocked || busy}
            />
            <span className={styles.hint}>
              {form.isSelf
                ? "Свои роль и права меняет другой сотрудник с доступом к правам."
                : "Роль — шаблон: при выборе галочки проставятся её набором, дальше правьте."}
            </span>
          </div>

          <PermissionsChecklist
            value={values.permissions}
            onToggle={form.togglePermission}
            canToggle={(permission) => !busy && form.canTogglePermission(permission)}
            isAdmin={values.role === USER_ROLES.ADMIN}
          />

          {form.error && <p role="alert" aria-live="polite" className="text-sm text-destructive">{form.error}</p>}
        </form>
      </Modal>

      <Modal
        open={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Удалить сотрудника?"
        footer={
          <>
            <Button type="button" onClick={() => setIsDeleteOpen(false)} disabled={form.isDeleting} className="">
              Отмена
            </Button>
            <Button type="button" disabled={form.isDeleting} className={styles.deleteButton} onClick={() => {
              setIsDeleteOpen(false);
              void form.remove();
            }}>
              {form.isDeleting ? "Удаляю…" : "Удалить насовсем"}
            </Button>
          </>
        }
      >
        <p>
          {form.target?.name} ({form.target?.login}) будет удалён насовсем и сразу потеряет доступ.
          Его комментарии, заказы и документы склада останутся с подписью «Удалённый сотрудник»,
          в журнале действий останется его логин. Вернуть аккаунт нельзя — только завести заново.
        </p>
      </Modal>
    </>
  );
}
