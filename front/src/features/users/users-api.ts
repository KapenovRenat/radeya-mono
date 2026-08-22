import type { CreateUserRequest, UserListItem } from "@radeya/shared";

import { baseApi } from "@/shared/api/base-api";

interface UsersResponse {
  items: UserListItem[];
}

/**
 * Сотрудники. Тег "User" связывает список и создание: после успешного
 * создания таблица перезапрашивается сама, вручную обновлять не нужно.
 */
export const usersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getUsers: build.query<UsersResponse, void>({
      query: () => "/users",
      providesTags: ["User"],
    }),

    createUser: build.mutation<UserListItem, CreateUserRequest>({
      query: (body) => ({
        url: "/users",
        method: "POST",
        body,
      }),
      // Журнал тоже пополнился записью — обновляем и его.
      invalidatesTags: ["User", "Audit"],
    }),
  }),
});

export const { useGetUsersQuery, useCreateUserMutation } = usersApi;
