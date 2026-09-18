"use client";

import { useEffect, useId, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";

import { cn } from "@/lib/utils";
import styles from "./style.module.scss";

export interface DropdownItem {
  /** Подпись пункта. Используется и как ключ списка, поэтому в одном меню не повторяется. */
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  /** Опасное действие — удаление. Красится в цвет предупреждения. */
  danger?: boolean;
}

export interface DropdownProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  items: DropdownItem[];
  /** Содержимое кнопки. По умолчанию — три точки. */
  trigger?: ReactNode;
  /** Подпись кнопки для скринридера: «три точки» сами по себе ничего не говорят. */
  label?: string;
  /** С какой стороны кнопки открывается меню. */
  align?: "start" | "end";
  disabled?: boolean;
}

/**
 * Базовое выпадающее меню.
 *
 * Своё, а не из UI-кита: китов в проекте нет по решению из STATUS.md.
 * Намеренно простое — пункты списком в пропсе, без вложенных подменю
 * и без портала. Дорабатывать будем по мере надобности; пока закрыты
 * три вещи, без которых меню раздражает: клик вне, Escape и стрелки.
 *
 * Меню не в портале, поэтому родитель не должен обрезать содержимое
 * (`overflow: hidden`) — иначе список окажется срезан. Это главное
 * ограничение текущей версии.
 */
export function Dropdown({ items, trigger, label = "Действия", align = "end",
  disabled = false, className, ...props }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        // Возврат фокуса на кнопку: иначе после Escape фокус уходит в никуда
        // и следующий Tab начинает обход страницы заново.
        root.current?.querySelector("button")?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  // Фокус на первый доступный пункт: с клавиатуры меню бесполезно без этого.
  useEffect(() => {
    if (!isOpen) return;
    menu.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [isOpen]);

  const moveFocus = (from: HTMLElement, step: 1 | -1) => {
    const buttons = [...(menu.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
    if (buttons.length === 0) return;
    const index = buttons.indexOf(from as HTMLButtonElement);
    // По кругу: с последнего пункта вниз попадаем на первый.
    buttons[(index + step + buttons.length) % buttons.length]?.focus();
  };

  return (
    <div ref={root} className={cn(styles.dropdown, className)} {...props}>
      <button
        type="button"
        className={styles.trigger}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={label}
        title={label}
        onClick={() => setIsOpen((open) => !open)}
      >
        {trigger ?? <MoreVertical size={16} aria-hidden="true" />}
      </button>

      {isOpen && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={label}
          className={cn(styles.menu, align === "start" ? styles.alignStart : styles.alignEnd)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();
            moveFocus(event.target as HTMLElement, event.key === "ArrowDown" ? 1 : -1);
          }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={cn(styles.item, item.danger && styles.danger)}
              disabled={item.disabled}
              onClick={() => {
                // Закрываем до действия: оно может перерисовать сам список
                // пунктов, и тогда закрывать будет уже нечего.
                setIsOpen(false);
                item.onSelect();
              }}
            >
              {item.icon && <span className={styles.icon} aria-hidden="true">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
