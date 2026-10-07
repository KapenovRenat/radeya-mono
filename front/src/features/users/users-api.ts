import type { CreateUserRequest, UpdateUserRequest, UserListItem } from "@radeya/shared";

import { baseApi } from "@/shared/api/base-api";

interface UsersResponse {
  items: UserListItem[];
}

/**
 * Сотрудники. Тег "User" связывает список и правки: после записи таблица
 * перезапрашивается сама. Своя карточка («Auth») тоже: права могли поменять
 * себе — меню и кнопки должны перестроиться без перезагрузки страницы.
 */
export const usersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getUsers: build.query<UsersResponse, void>({
      query: () => "/users",
      providesTags: ["User"],
    }),

    createUser: build.mutation<UserListItem, CreateUserRequest>({
      query: (body) => ({ url: "/users", method: "POST", body }),
      // Журнал тоже пополнился записью — обновляем и его.
      invalidatesTags: ["User", "Audit"],
    }),

    updateUser: build.mutation<UserListItem, { id: string } & UpdateUserRequest>({
      query: ({ id, ...body }) => ({ url: `/users/${id}`, method: "PATCH", body }),
      invalidatesTags: ["User", "Audit", "Auth"],
    }),

    deleteUser: build.mutation<void, string>({
      query: (id) => ({ url: `/users/${id}`, method: "DELETE" }),
      invalidatesTags: ["User", "Audit"],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
} = usersApi;
