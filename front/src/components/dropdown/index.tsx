"use client";

import { useCallback, useEffect, useId, useRef, useState,
  type ComponentPropsWithoutRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

import { cn } from "@/lib/utils";
import styles from "./style.module.scss";

/** Запас до края окна, чтобы меню не прилипало к нему вплотную. */
const VIEWPORT_GAP = 8;

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
 * Меню уходит в портал на document.body и позиционируется fixed по месту
 * кнопки. Иначе его режет любой скроллящийся родитель: `overflow-x: auto`
 * у таблицы обрезает и по вертикали, и у нижних строк меню оказывалось
 * недоступно. Побочный эффект портала — меню не переезжает вместе со
 * страницей, поэтому при прокрутке и смене размера окна оно закрывается.
 */
export function Dropdown({ items, trigger, label = "Действия", align = "end",
  disabled = false, className, ...props }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const close = useCallback((returnFocus: boolean) => {
    setIsOpen(false);
    setPosition(null);
    // Возврат фокуса на кнопку: иначе после Escape фокус уходит в никуда
    // и следующий Tab начинает обход страницы заново.
    if (returnFocus) root.current?.querySelector("button")?.focus();
  }, []);

  // Позиция считается после отрисовки меню: нужны его настоящие размеры,
  // чтобы понять, разворачивать вверх или вниз. Обычный useEffect, а не
  // useLayoutEffect: тот ругается при серверном рендере, а мигания и так нет —
  // до подсчёта меню скрыто через visibility.
  useEffect(() => {
    if (!isOpen) return;
    const button = root.current?.getBoundingClientRect();
    const box = menu.current?.getBoundingClientRect();
    if (!button || !box) return;

    const below = button.bottom + 4;
    const fitsBelow = below + box.height + VIEWPORT_GAP <= window.innerHeight;
    const top = fitsBelow ? below : Math.max(VIEWPORT_GAP, button.top - box.height - 4);
    const raw = align === "end" ? button.right - box.width : button.left;
    const left = Math.min(Math.max(VIEWPORT_GAP, raw), window.innerWidth - box.width - VIEWPORT_GAP);

    setPosition({ top, left });
  }, [isOpen, align, items.length]);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (root.current?.contains(target) || menu.current?.contains(target)) return;
      close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    // Меню закреплено за окном, а не за строкой таблицы: при прокрутке оно
    // отъехало бы от своей кнопки. Дешевле закрыть, чем пересчитывать.
    const onViewportChange = () => close(false);

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onViewportChange);
    document.addEventListener("scroll", onViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onViewportChange);
      document.removeEventListener("scroll", onViewportChange, true);
    };
  }, [isOpen, close]);

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

      {isOpen && createPortal(
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={label}
          // Пока позиция не посчитана, меню невидимо: иначе оно на кадр
          // мигнёт в левом верхнем углу экрана.
          style={{ top: position?.top ?? 0, left: position?.left ?? 0,
            visibility: position ? "visible" : "hidden" }}
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
                close(false);
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
