"use client";

import { USER_ROLE_LABELS } from "@radeya/shared";

import { useGetUsersQuery } from "@/features/users/users-api";
import { formatDateTime } from "@/lib/format";

/** Таблица сотрудников. Свой аккаунт тоже здесь — он такой же пользователь. */
export function UsersTable() {
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
          <th className="py-2 font-medium">Создан</th>
        </tr>
      </thead>

      <tbody>
        {users.map((user) => (
          <tr key={user.id} className="border-t">
            <td className="py-2">{user.login}</td>
            <td className="py-2">{user.name}</td>
            <td className="py-2">{user.position}</td>
            <td className="py-2">{USER_ROLE_LABELS[user.role]}</td>
            <td className="py-2">{formatDateTime(user.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
