"use client";

import { useEffect, useRef } from "react";
import { CATEGORY_NAME_MAX_LENGTH, CATALOG_SEARCH_MAX_LENGTH, type CatalogResponse } from "@radeya/shared";
import { Loader } from "@/components/loader";
import { Tables } from "@/components/tables";
import { TreeFolder } from "@/components/tree-folder";
import { useCreateCategoryForm } from "@/features/categories/use-create-category-form";
import { useCategoryActions } from "@/features/categories/use-category-actions";
import { useProductCatalog } from "@/features/products/use-product-catalog";

export default function ProductsPage() {
  const catalog = useProductCatalog();
  const categoryForm = useCreateCategoryForm(catalog.onCategoryCreated);
  const categoryActions = useCategoryActions(catalog.onCategoryDeleted);
  const lastLogged = useRef<CatalogResponse | undefined>(undefined);
  const { response, isLoading } = catalog;

  useEffect(() => {
    if (isLoading || !response || lastLogged.current === response) return;
    lastLogged.current = response;
    // Только полученная страница: полный каталог ради отладки не загружаем.
    console.log("[Каталог товаров] Ответ сервера:", response);
  }, [response, isLoading]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Товары</h1>

      <div className="grid items-start gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">

        <div className="space-y-4">
          <TreeFolder
            items={catalog.categories}
            allLabel={catalog.allProducts.name}
            selectedId={catalog.categoryId}
            expandedIds={catalog.expandedCategoryIds}
            onSelect={catalog.selectCategory}
            onToggle={catalog.toggleCategory}
            onCreate={(parentId) => {
              categoryActions.close();
              categoryForm.open(parentId);
            }}
            onEdit={(category) => {
              categoryForm.close();
              categoryActions.open("rename", category);
            }}
            onDelete={(category) => {
              categoryForm.close();
              categoryActions.open("delete", category);
            }}
            disabled={categoryForm.isSaving || categoryActions.isSaving}
            isLoading={catalog.isLoadingCategories}
            error={catalog.categoriesError}
            onRetry={catalog.reloadCategories}
          />

          {categoryActions.action && (
            <form className="space-y-3 rounded-md border border-border p-3" onSubmit={(event) => {
              event.preventDefault();
              void categoryActions.submit();
            }}>
              <p className="font-medium">
                {categoryActions.action.mode === "rename" ? "Редактирование: " : "Удалить папку: "}
                {categoryActions.action.category.name}
              </p>
              {categoryActions.action.mode === "rename" ? (
                <label className="block space-y-1">
                  <span>Название категории</span>
                  <input autoFocus required maxLength={CATEGORY_NAME_MAX_LENGTH}
                    className="w-full rounded-md border border-border bg-background px-3 py-2"
                    value={categoryActions.name} onChange={(event) => categoryActions.setName(event.target.value)}
                    disabled={categoryActions.isSaving} />
                </label>
              ) : <p className="text-sm text-muted-foreground">Удалить можно только пустую папку без товаров и подпапок.</p>}
              {categoryActions.error && <p role="alert" className="text-sm text-destructive">{categoryActions.error}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={categoryActions.isSaving} aria-busy={categoryActions.isSaving}
                  className="rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">
                  {categoryActions.isSaving ? <Loader label="Обработка" />
                    : categoryActions.action.mode === "rename" ? "Сохранить" : "Удалить"}
                </button>
                <button type="button" onClick={categoryActions.close} disabled={categoryActions.isSaving}
                  className="rounded-md border border-border px-3 py-2 disabled:opacity-50">Отмена</button>
              </div>
            </form>
          )}

          {categoryForm.isOpen && (
            <form className="space-y-3 rounded-md border border-border p-3" onSubmit={(event) => {
              event.preventDefault();
              void categoryForm.submit();
            }}>
              <p className="text-sm text-muted-foreground">
                {categoryForm.parentId
                  ? "Новая подпапка в «" + (catalog.categories.find((item) => item.id === categoryForm.parentId)?.name ?? "Категория") + "»"
                  : "Новая категория верхнего уровня"}
              </p>
              <label className="block space-y-1">
                <span>Название категории</span>
                <input className="w-full rounded-md border border-border bg-background px-3 py-2"
                  autoFocus required maxLength={CATEGORY_NAME_MAX_LENGTH} value={categoryForm.name}
                  onChange={(event) => categoryForm.setName(event.target.value)} disabled={categoryForm.isSaving} />
              </label>
              {categoryForm.error && <p role="alert" className="text-sm text-destructive">{categoryForm.error}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={categoryForm.isSaving} aria-busy={categoryForm.isSaving}
                  className="rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">
                  {categoryForm.isSaving ? <Loader label="Создание" /> : "Создать"}
                </button>
                <button type="button" onClick={categoryForm.close} disabled={categoryForm.isSaving}
                  className="rounded-md border border-border px-3 py-2 disabled:opacity-50">Отмена</button>
              </div>
            </form>
          )}

        </div>

        <div className="min-w-0 space-y-4">

          <label className="block space-y-1">
            <span className="text-sm">Поиск по названию или артикулу</span>
            <input type="search" value={catalog.search} maxLength={CATALOG_SEARCH_MAX_LENGTH}
              onChange={(event) => catalog.setSearch(event.target.value)}
              placeholder="Введите название или артикул"
              className="w-full rounded-md border border-border bg-background px-3 py-2" />
          </label>

          <Tables
            page={catalog.page}
            pageSize={catalog.pageSize}
            total={catalog.total}
            onPageChange={catalog.setPage}
            onPageSizeChange={catalog.setPageSize}
            isLoading={catalog.isLoading}
            error={catalog.error}
            onRetry={catalog.reload}
          >
            {/* Здесь будут ваши строки: catalog.items.map(...) с <tr> и <td>. */}
          </Tables>

        </div>
      </div>
    </div>
  );
}
