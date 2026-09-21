"use client";

import { useEffect, useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

import { useAnchoredPanel } from "@/lib/use-anchored-panel";
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
 * Намеренно простое — пункты списком в пропсе, без вложенных подменю.
 * Закрыто то, без чего меню раздражает: клик вне, Escape, стрелки.
 *
 * Портал, положение, клик вне и Escape — в общем хуке `useAnchoredPanel`:
 * тем же занят календарь выбора периода, и копия этой логики разъехалась бы
 * с оригиналом на первой же правке.
 */
export function Dropdown({ items, trigger, label = "Действия", align = "end",
  disabled = false, className, ...props }: DropdownProps) {
  const panel = useAnchoredPanel(align);
  const menuId = useId();
  const { isOpen, panelRef: menu, close } = panel;

  // Фокус на первый доступный пункт: с клавиатуры меню бесполезно без этого.
  useEffect(() => {
    if (!isOpen) return;
    menu.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [isOpen, menu]);

  const moveFocus = (from: HTMLElement, step: 1 | -1) => {
    const buttons = [...(menu.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
    if (buttons.length === 0) return;
    const index = buttons.indexOf(from as HTMLButtonElement);
    // По кругу: с последнего пункта вниз попадаем на первый.
    buttons[(index + step + buttons.length) % buttons.length]?.focus();
  };

  return (
    <div ref={panel.anchorRef} className={cn(styles.dropdown, className)} {...props}>
      <button
        type="button"
        className={styles.trigger}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={label}
        title={label}
        onClick={panel.toggle}
      >
        {trigger ?? <MoreVertical size={16} aria-hidden="true" />}
      </button>

      {isOpen && createPortal(
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={label}
          // Пока позиция не посчитана, меню невидимо: иначе оно на кадр
          // мигнёт в левом верхнем углу экрана.
          style={{ top: panel.position?.top ?? 0, left: panel.position?.left ?? 0,
            visibility: panel.position ? "visible" : "hidden" }}
          className={styles.menu}
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
                close();
                item.onSelect();
              }}
            >
              {item.icon && <span className={styles.icon} aria-hidden="true">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
