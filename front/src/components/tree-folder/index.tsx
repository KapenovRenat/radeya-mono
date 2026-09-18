"use client";

import type { ComponentPropsWithoutRef } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Folder, FolderOpen,
  Plus, Pencil, Search, Trash2 } from "lucide-react";
import { ALL_PRODUCTS_LABEL, type CategoryDto, type CategoryTreeNode } from "@radeya/shared";
import { Dropdown, type DropdownItem } from "@/components/dropdown";
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
  /** Переставить папку внутри своего уровня. Крайние позиции блокирует сам компонент. */
  onMove?: (category: CategoryDto, direction: "up" | "down") => void;
  /** Поиск по дереву. Без обработчика поле не показывается. */
  search?: string;
  onSearchChange?: (value: string) => void;
  /** Показывается вместо дерева, когда поиск ничего не нашёл. */
  emptyLabel?: string;
  disabled?: boolean;
  allLabel?: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function TreeFolder({ items, selectedId, expandedIds, onSelect, onToggle,
  onCreate, onEdit, onDelete, onMove, search, onSearchChange,
  emptyLabel = "Ничего не найдено", disabled = false, allLabel = ALL_PRODUCTS_LABEL,
  isLoading = false, error, onRetry, className, ...props }: TreeFolderProps) {
  const actionsDisabled = disabled || isLoading || Boolean(error);

  /** Пункты меню одной папки. Порядок важен: опасное действие последним. */
  const folderActions = (folder: CategoryTreeNode, index: number, total: number): DropdownItem[] => {
    const actions: DropdownItem[] = [];

    // Третий уровень запрещён на сервере, поэтому подпапку предлагаем только корню.
    if (onCreate && folder.parentId === null) {
      actions.push({ label: "Создать подпапку", icon: <Plus size={16} />,
        onSelect: () => onCreate(folder.id) });
    }
    if (onEdit) {
      actions.push({ label: "Переименовать", icon: <Pencil size={16} />,
        onSelect: () => onEdit(folder) });
    }
    if (onMove) {
      actions.push({ label: "Выше", icon: <ArrowUp size={16} />, disabled: index === 0,
        onSelect: () => onMove(folder, "up") });
      actions.push({ label: "Ниже", icon: <ArrowDown size={16} />, disabled: index === total - 1,
        onSelect: () => onMove(folder, "down") });
    }
    if (onDelete) {
      actions.push({ label: "Удалить", icon: <Trash2 size={16} />, danger: true,
        onSelect: () => onDelete(folder) });
    }

    return actions;
  };

  const renderFolders = (folders: CategoryTreeNode[]) => (
    <ul className={styles.list}>
      {folders.map((folder, index) => {
        const expanded = expandedIds.includes(folder.id);
        const hasChildren = folder.children.length > 0;
        const Icon = expanded ? FolderOpen : Folder;
        const actions = folderActions(folder, index, folders.length);
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
              {actions.length > 0 && (
                <Dropdown className={styles.actions} items={actions} disabled={actionsDisabled}
                  label={"Действия с «" + folder.name + "»"} />
              )}
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

        {onSearchChange && (
          <label className={styles.search}>
            <Search size={16} aria-hidden="true" />
            {/* Поиск по уже полученному дереву, поэтому type="search" без формы:
                отправлять нечего, фильтрация идёт на вводе. */}
            <input type="search" value={search ?? ""} disabled={disabled || isLoading}
              placeholder="Поиск категории" aria-label="Поиск категории"
              onChange={(event) => onSearchChange(event.target.value)} />
          </label>
        )}
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
          : items.length === 0 ? <p className={cn(styles.message, styles.empty)}>{emptyLabel}</p>
          : renderFolders(items)}
      </nav>

    </div>
  );
}
