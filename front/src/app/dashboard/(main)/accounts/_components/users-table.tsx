"use client";

import { ALL_PERMISSIONS, USER_ROLES, USER_ROLE_LABELS, type UserListItem } from "@radeya/shared";

import { useGetUsersQuery } from "@/features/users/users-api";
import { formatDateTime } from "@/lib/format";
import styles from "./accounts.module.scss";

/**
 * Таблица сотрудников. Свой аккаунт тоже здесь — он такой же пользователь.
 * Клик по строке (или Enter на ней) открывает окно сотрудника.
 */
export function UsersTable({ onOpen }: { onOpen: (user: UserListItem) => void }) {
  const { data, isLoading, isError } = useGetUsersQuery();

  if (isLoading) return <p className="text-sm text-muted-foreground">Загружаю…</p>;

  if (isError)
    return <p className="text-sm text-destructive">Не удалось загрузить список</p>;

  const users = data?.items ?? [];

  if (users.length === 0)
    return <p className="text-sm text-muted-foreground">Аккаунтов пока нет</p>;

  return (
    <table className="w-full text-left text-sm">
      <thead className="text-muted-foreground">
        <tr>
          <th className="py-2 font-medium">Логин</th>
          <th className="py-2 font-medium">Имя</th>
          <th className="py-2 font-medium">Должность</th>
          <th className="py-2 font-medium">Роль</th>
          <th className="py-2 font-medium">Права</th>
          <th className="py-2 font-medium">Создан</th>
        </tr>
      </thead>

      <tbody>
        {users.map((user) => (
          <tr
            key={user.id}
            className={styles.userRow}
            onClick={() => onOpen(user)}
            // Строка — кнопка для клавиатуры: Tab до неё, Enter — открыть.
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen(user);
              }
            }}
            aria-label={"Открыть сотрудника " + user.name}
          >
            <td className="py-2">{user.login}</td>
            <td className="py-2">{user.name}</td>
            <td className="py-2">{user.position}</td>
            <td className="py-2">{USER_ROLE_LABELS[user.role]}</td>
            <td className="py-2">
              {user.role === USER_ROLES.ADMIN ? "все" : `${user.permissions.length} из ${ALL_PERMISSIONS.length}`}
            </td>
            <td className="py-2">{formatDateTime(user.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
