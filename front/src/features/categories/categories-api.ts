import type { CategoryDto, CategoryTreeResponse, CreateCategoryRequest, RenameCategoryRequest,
  DeleteCategoryResponse, ReorderCategoriesRequest, ReorderCategoriesResponse } from "@radeya/shared";
import { baseApi } from "@/shared/api/base-api";

export const categoriesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCategoryTree: build.query<CategoryTreeResponse, void>({
      query: () => "/categories",
      providesTags: ["Category"],
    }),
    renameCategory: build.mutation<CategoryDto, { id: string; body: RenameCategoryRequest }>({
      query: ({ id, body }) => ({ url: "/categories/" + id, method: "PATCH", body }),
      invalidatesTags: ["Category", "Product", "Audit"],
    }),
    deleteCategory: build.mutation<DeleteCategoryResponse, string>({
      query: (id) => ({ url: "/categories/" + id, method: "DELETE" }),
      invalidatesTags: ["Category", "Product", "Audit"],
    }),
    createCategory: build.mutation<CategoryDto, CreateCategoryRequest>({
      query: (body) => ({ url: "/categories", method: "POST", body }),
      invalidatesTags: ["Category", "Audit"],
    }),
    reorderCategories: build.mutation<ReorderCategoriesResponse, ReorderCategoriesRequest>({
      query: (body) => ({ url: "/categories/order", method: "PATCH", body }),
      // Порядок меняется нажатием на пункт меню, и папка должна переехать сразу:
      // ожидание ответа с перерисовкой дерева выглядит как заедание.
      async onQueryStarted(body, { dispatch, queryFulfilled }) {
        const patch = dispatch(categoriesApi.util.updateQueryData("getCategoryTree", undefined, (draft) => {
          const level = body.parentId === null
            ? draft.items
            : draft.items.find((item) => item.id === body.parentId)?.children;
          if (!level) return;
          const byId = new Map(level.map((item) => [item.id, item]));
          const sorted = body.ids.map((id) => byId.get(id));
          // Дерево могло измениться в другой вкладке: тогда отдаём его серверу,
          // а не собираем список с дырами.
          if (sorted.some((item) => item === undefined)) return;
          level.splice(0, level.length, ...(sorted as typeof level));
        }));
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      // Тег Category не сбрасываем: ответ ничего не добавляет к тому, что уже
      // показано, а повторная загрузка дерева вернула бы прыжок прокрутки.
      invalidatesTags: ["Audit"],
    }),
  }),
});
export const { useGetCategoryTreeQuery, useCreateCategoryMutation, useRenameCategoryMutation,
  useDeleteCategoryMutation, useReorderCategoriesMutation } = categoriesApi;
