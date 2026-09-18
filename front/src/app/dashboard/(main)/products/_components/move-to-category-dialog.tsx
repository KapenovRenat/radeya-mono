"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { ALL_PRODUCTS_LABEL, CATEGORY_NAME_MAX_LENGTH, type CategoryTreeNode } from "@radeya/shared";

import { Button } from "@/components/button";
import { TreeFolder } from "@/components/tree-folder";
import { filterTree } from "@/features/categories/filter-tree";

interface MoveToCategoryDialogProps {
  open: boolean;
  onClose: () => void;
  categories: CategoryTreeNode[];
  /** Сколько товаров переносим — показываем в подтверждении. */
  count: number;
  isMoving: boolean;
  error: string | null;
  /** true — перенос удался, модалку можно закрывать. */
  onConfirm: (categoryId: string | null) => Promise<boolean>;
}

/**
 * Перенос выбранных товаров в папку.
 *
 * Нативный <dialog>, как в модалке аккаунтов: ловушка фокуса, Escape
 * и подложка достаются бесплатно.
 *
 * Два шага в одном окне: выбор папки, затем подтверждение с названием
 * и количеством. Перенос затрагивает сразу пачку товаров, и промах по
 * соседней папке в дереве обнаружится не сразу — поэтому спрашиваем.
 */
export function MoveToCategoryDialog({ open, onClose, categories, count,
  isMoving, error, onConfirm }: MoveToCategoryDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  // undefined — папка ещё не выбрана; null — «Все товары», то есть снять папку.
  const [target, setTarget] = useState<{ id: string | null; name: string } | undefined>(undefined);
  const [isConfirming, setIsConfirming] = useState(false);

  const filtered = useMemo(() => filterTree(categories, search), [categories, search]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const names = useMemo(() => {
    const map = new Map<string | null, string>([[null, ALL_PRODUCTS_LABEL]]);
    for (const parent of categories) {
      map.set(parent.id, parent.name);
      for (const child of parent.children) map.set(child.id, parent.name + " / " + child.name);
    }
    return map;
  }, [categories]);

  const reset = () => {
    setSearch("");
    setExpandedIds([]);
    setTarget(undefined);
    setIsConfirming(false);
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={() => {
        reset();
        onClose();
      }}
      // Клик по подложке приходит на сам <dialog>, поэтому отступов у него нет:
      // иначе клик по полям внутри считался бы кликом мимо окна.
      onClick={(event) => {
        if (event.target === event.currentTarget && !isMoving) dialogRef.current?.close();
      }}
      className="m-auto w-full max-w-md rounded-lg border bg-background p-0 text-foreground backdrop:bg-black/50"
    >
      <div className="flex max-h-[80vh] flex-col gap-4 p-6">

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Переместить {count === 1 ? "товар" : "товары"}: {count}
          </h2>
          <button type="button" onClick={() => dialogRef.current?.close()} disabled={isMoving}
            aria-label="Закрыть"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        {isConfirming && target !== undefined ? (
          <>
            <p>
              Переместить {count} шт. в{" "}
              <strong>{target.id === null ? "«Все товары» (снять папку)" : "«" + (names.get(target.id) ?? target.name) + "»"}</strong>?
            </p>
            {target.id === null && (
              <p className="text-sm text-muted-foreground">
                «Все товары» — это обзор, а не папка: у товаров просто не останется категории.
              </p>
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button className="" type="button" disabled={isMoving}
                onClick={() => void onConfirm(target.id).then((ok) => {
                  if (ok) dialogRef.current?.close();
                })}>
                {isMoving ? "Перемещаю…" : "Да, переместить"}
              </Button>
              <Button className="" type="button" disabled={isMoving}
                onClick={() => setIsConfirming(false)}>Назад</Button>
            </div>
          </>
        ) : (
          <>
            <div className="min-h-0 overflow-y-auto">
              <TreeFolder
                items={filtered.items}
                allLabel={ALL_PRODUCTS_LABEL}
                selectedId={target === undefined ? null : target.id}
                expandedIds={[...new Set([...expandedIds, ...filtered.expand])]}
                onSelect={(id) => setTarget({ id, name: names.get(id) ?? ALL_PRODUCTS_LABEL })}
                onToggle={(id) => setExpandedIds((previous) => previous.includes(id)
                  ? previous.filter((value) => value !== id) : [...previous, id])}
                search={search}
                onSearchChange={(value) => setSearch(value.slice(0, CATEGORY_NAME_MAX_LENGTH))}
                disabled={isMoving}
              />
            </div>

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button className="" type="button" disabled={target === undefined || isMoving}
                onClick={() => setIsConfirming(true)}>Переместить</Button>
              <Button className="" type="button" disabled={isMoving}
                onClick={() => dialogRef.current?.close()}>Отмена</Button>
            </div>
          </>
        )}

      </div>
    </dialog>
  );
}
