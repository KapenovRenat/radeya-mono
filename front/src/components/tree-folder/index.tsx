"use client";

import type { ComponentPropsWithoutRef } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen, Plus, Pencil, Trash2 } from "lucide-react";
import { ALL_PRODUCTS_LABEL, type CategoryDto, type CategoryTreeNode } from "@radeya/shared";
import { Loader } from "@/components/loader";
import { cn } from "@/lib/utils";
import styles from "./style.module.scss";

export interface TreeFolderProps extends Omit<ComponentPropsWithoutRef<"div">, "children" | "onSelect" | "onToggle"> {
  items: CategoryTreeNode[];
  selectedId: string | null;
  expandedIds: readonly string[];
  onSelect: (id: string | null) => void;
  onToggle: (id: string) => void;
  onCreate?: (parentId: string | null) => void;
  onEdit?: (category: CategoryDto) => void;
  onDelete?: (category: CategoryDto) => void;
  disabled?: boolean;
  allLabel?: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function TreeFolder({ items, selectedId, expandedIds, onSelect, onToggle,
  onCreate, onEdit, onDelete, disabled = false, allLabel = ALL_PRODUCTS_LABEL, isLoading = false, error,
  onRetry, className, ...props }: TreeFolderProps) {
  const actionsDisabled = disabled || isLoading || Boolean(error);
  const renderFolders = (folders: CategoryTreeNode[]) => (
    <ul className={styles.list}>
      {folders.map((folder) => {
        const expanded = expandedIds.includes(folder.id);
        const hasChildren = folder.children.length > 0;
        const Icon = expanded ? FolderOpen : Folder;
        return (
          <li key={folder.id}>
            <div className={cn(styles.row, selectedId === folder.id && styles.selected)}>
              {hasChildren ? (
                <button type="button" className={styles.toggle} disabled={disabled} onClick={() => onToggle(folder.id)}
                  aria-expanded={expanded} aria-label={(expanded ? "Свернуть " : "Раскрыть ") + folder.name}>
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              ) : <span className={styles.toggleSpace} aria-hidden="true" />}
              <button type="button" className={styles.folder} disabled={disabled} onClick={() => onSelect(folder.id)}
                aria-current={selectedId === folder.id ? "true" : undefined}>
                <Icon size={18} aria-hidden="true" />
                <span>{folder.name}</span>
              </button>
              <div className={styles.actions}>
                {onCreate && folder.parentId === null && (
                  <button type="button" className={styles.action} disabled={actionsDisabled}
                    onClick={() => onCreate(folder.id)} title="Создать подпапку"
                    aria-label={"Создать подпапку в «" + folder.name + "»"}><Plus size={16} aria-hidden="true" /></button>
                )}
                {onEdit && <button type="button" className={styles.action} disabled={actionsDisabled}
                  onClick={() => onEdit(folder)} title="Редактировать название"
                  aria-label={"Редактировать «" + folder.name + "»"}><Pencil size={16} aria-hidden="true" /></button>}
                {onDelete && <button type="button" className={cn(styles.action, styles.delete)} disabled={actionsDisabled}
                  onClick={() => onDelete(folder)} title="Удалить категорию"
                  aria-label={"Удалить «" + folder.name + "»"}><Trash2 size={16} aria-hidden="true" /></button>}
              </div>
            </div>
            {hasChildren && expanded && <div className={styles.nested}>{renderFolders(folder.children)}</div>}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div {...props} className={cn(styles.tree, className)}>
      <div className={styles.toolbar}>
        <span className={styles.title}>Категории</span>
        {onCreate && <button type="button" className={styles.create} onClick={() => onCreate(null)}
          disabled={actionsDisabled}>
          <Plus size={16} aria-hidden="true" /> Создать категорию
        </button>}
      </div>
      <nav aria-label="Категории товаров" aria-busy={isLoading}>
        <button type="button" className={cn(styles.all, selectedId === null && styles.selected)}
          disabled={disabled} onClick={() => onSelect(null)} aria-current={selectedId === null ? "true" : undefined}>
          <FolderOpen size={18} aria-hidden="true" /> {allLabel}
        </button>
        {isLoading ? <div className={styles.message}><Loader label="Загрузка категорий" /></div>
          : error ? <div className={styles.message} role="alert">{error}
              {onRetry && <button type="button" onClick={onRetry}>Повторить</button>}
            </div>
          : renderFolders(items)}
      </nav>
    </div>
  );
}
