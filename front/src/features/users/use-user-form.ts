"use client";

import { useCallback, useRef, useState } from "react";
import {
  PASSWORD_MIN_LENGTH,
  ROLE_PERMISSION_TEMPLATES,
  USER_ROLES,
  normalizeLogin,
  normalizePermissions,
  type Permission,
  type UserListItem,
  type UserRole,
} from "@radeya/shared";

import { useAuth } from "@/features/auth/use-auth";
import { apiErrorMessage, apiFieldErrors } from "@/shared/api/error-message";
import { useCreateUserMutation, useDeleteUserMutation, useUpdateUserMutation } from "./users-api";

export interface UserFormValues {
  name: string;
  login: string;
  /** У нового — обязателен; у существующего — пусто значит «не менять». */
  password: string;
  position: string;
  role: UserRole;
  permissions: Permission[];
}

// Роль по умолчанию — самая безобидная. Забыли выбрать — сотрудник получит
// минимум прав, а не полный доступ.
const DEFAULT_ROLE: UserRole = USER_ROLES.SELLER;

function emptyValues(): UserFormValues {
  return {
    name: "", login: "", password: "", position: "",
    role: DEFAULT_ROLE, permissions: [...ROLE_PERMISSION_TEMPLATES[DEFAULT_ROLE]],
  };
}

function valuesOf(user: UserListItem): UserFormValues {
  return {
    name: user.name, login: user.login, password: "", position: user.position,
    role: user.role, permissions: normalizePermissions(user.permissions),
  };
}

/**
 * Окно сотрудника: создание и правка одной формой, права галочками, удаление.
 *
 * Роль — шаблон: выбрали роль — галочки проставились её набором, дальше
 * правятся руками. Ограничения те же, что на сервере (users.service.ts),
 * чтобы не предлагать того, на что сервер ответит 403:
 * - не админ не назначает админа и не трогает админов;
 * - не админ ставит и снимает только свои права;
 * - свои роль и права не меняет никто.
 * Сервер проверит всё это сам — здесь только подсказка интерфейсом.
 */
export function useUserForm() {
  const { user: actor } = useAuth();
  const [target, setTarget] = useState<UserListItem | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [values, setValues] = useState<UserFormValues>(emptyValues);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const busy = useRef(false);

  const [createUser, createState] = useCreateUserMutation();
  const [updateUser, updateState] = useUpdateUserMutation();
  const [deleteUser, deleteState] = useDeleteUserMutation();

  const actorIsAdmin = actor?.role === USER_ROLES.ADMIN;
  const isSelf = target !== null && actor !== null && target.id === actor.id;
  // Админа правит только админ — для остальных карточка только для чтения.
  const readOnly = target !== null && target.role === USER_ROLES.ADMIN && !actorIsAdmin;
  const accessLocked = readOnly || isSelf;

  const openCreate = useCallback(() => {
    setTarget(null);
    setValues(emptyValues());
    setError(null);
    setFieldErrors({});
    setIsOpen(true);
  }, []);

  const openEdit = useCallback((user: UserListItem) => {
    setTarget(user);
    setValues(valuesOf(user));
    setError(null);
    setFieldErrors({});
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    if (!busy.current) setIsOpen(false);
  }, []);

  const setField = useCallback(<K extends "name" | "login" | "password" | "position">(field: K, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    // Ошибку поля снимаем сразу при правке — держать её до отправки незачем.
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  /**
   * Роль — шаблон: галочки заменяются её набором. Не админ меняет только
   * свои права, поэтому чужие ему галочки остаются как были — иначе сервер
   * отказал бы во всей правке.
   */
  const setRole = useCallback((role: UserRole) => {
    setValues((current) => {
      const template = ROLE_PERMISSION_TEMPLATES[role];

      if (actorIsAdmin) return { ...current, role, permissions: [...template] };

      const own = new Set(actor?.permissions ?? []);
      const kept = current.permissions.filter((permission) => !own.has(permission));
      const given = template.filter((permission) => own.has(permission));

      return { ...current, role, permissions: normalizePermissions([...kept, ...given]) };
    });
  }, [actor, actorIsAdmin]);

  /** Может ли текущий сотрудник ставить и снимать это право. */
  const canTogglePermission = useCallback((permission: Permission) => {
    if (accessLocked || values.role === USER_ROLES.ADMIN) return false;

    return actorIsAdmin || (actor?.permissions.includes(permission) ?? false);
  }, [accessLocked, actor, actorIsAdmin, values.role]);

  const togglePermission = useCallback((permission: Permission, checked: boolean) => {
    if (!canTogglePermission(permission)) return;

    setValues((current) => ({
      ...current,
      permissions: normalizePermissions(checked
        ? [...current.permissions, permission]
        : current.permissions.filter((item) => item !== permission)),
    }));
  }, [canTogglePermission]);

  /** Роли, которые можно выбрать: админа назначает только админ. */
  const roleOptions = (Object.values(USER_ROLES) as UserRole[])
    .filter((role) => role !== USER_ROLES.ADMIN || actorIsAdmin);

  const submit = useCallback(async () => {
    if (busy.current || readOnly) return;

    if (target === null && values.password.length < PASSWORD_MIN_LENGTH) {
      setFieldErrors({ password: `Не короче ${PASSWORD_MIN_LENGTH} символов` });

      return;
    }

    busy.current = true;
    setError(null);
    setFieldErrors({});

    const card = {
      name: values.name.trim(),
      position: values.position.trim(),
      role: values.role,
      permissions: values.permissions,
    };

    try {
      if (target === null) {
        await createUser({ ...card, login: normalizeLogin(values.login), password: values.password }).unwrap();
      } else {
        await updateUser({
          id: target.id,
          ...card,
          ...(values.password !== "" ? { password: values.password } : {}),
        }).unwrap();
      }

      setIsOpen(false);
    } catch (requestError) {
      setFieldErrors(apiFieldErrors(requestError));
      setError(apiErrorMessage(requestError, "Не удалось сохранить сотрудника"));
    } finally {
      busy.current = false;
    }
  }, [createUser, readOnly, target, updateUser, values]);

  /** Удаление насовсем: сессии гаснут, его записи остаются без автора. */
  const remove = useCallback(async () => {
    if (busy.current || target === null) return false;

    busy.current = true;
    setError(null);

    try {
      await deleteUser(target.id).unwrap();
      setIsOpen(false);

      return true;
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Не удалось удалить сотрудника"));

      return false;
    } finally {
      busy.current = false;
    }
  }, [deleteUser, target]);

  return {
    isOpen, openCreate, openEdit, close,
    target, isNew: target === null, isSelf, readOnly, accessLocked,
    values, setField, setRole, roleOptions,
    togglePermission, canTogglePermission,
    // Удалить нельзя себя и — не админу — админа.
    canDelete: target !== null && !isSelf && !readOnly,
    submit, remove,
    error, fieldErrors,
    isSaving: createState.isLoading || updateState.isLoading,
    isDeleting: deleteState.isLoading,
  };
}

export type UserForm = ReturnType<typeof useUserForm>;
