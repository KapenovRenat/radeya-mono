import type { CategoryDto, CategoryTreeResponse, CreateCategoryRequest, RenameCategoryRequest, DeleteCategoryResponse } from "@radeya/shared";
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
  }),
});
export const { useGetCategoryTreeQuery, useCreateCategoryMutation, useRenameCategoryMutation, useDeleteCategoryMutation } = categoriesApi;
