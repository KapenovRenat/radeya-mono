import type { CategoryDto, CategoryTreeResponse, CreateCategoryRequest } from "@radeya/shared";
import { baseApi } from "@/shared/api/base-api";

export const categoriesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCategoryTree: build.query<CategoryTreeResponse, void>({
      query: () => "/categories",
      providesTags: ["Category"],
    }),
    createCategory: build.mutation<CategoryDto, CreateCategoryRequest>({
      query: (body) => ({ url: "/categories", method: "POST", body }),
      invalidatesTags: ["Category", "Audit"],
    }),
  }),
});
export const { useGetCategoryTreeQuery, useCreateCategoryMutation } = categoriesApi;
