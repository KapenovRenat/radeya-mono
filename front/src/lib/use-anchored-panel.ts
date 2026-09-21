"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/** Запас до края окна, чтобы панель не прилипала к нему вплотную. */
const VIEWPORT_GAP = 8;

export interface AnchoredPanel {
  isOpen: boolean;
  toggle: () => void;
  close: (returnFocus?: boolean) => void;
  /** На кнопку-триггер: от неё считается положение панели. */
  anchorRef: RefObject<HTMLDivElement | null>;
  /** На саму панель: нужны её размеры, чтобы понять, куда разворачивать. */
  panelRef: RefObject<HTMLDivElement | null>;
  /** Координаты для `position: fixed`. null — ещё не посчитаны. */
  position: { top: number; left: number } | null;
}

/**
 * Всплывающая панель, привязанная к кнопке.
 *
 * Панель живёт в портале и позиционируется `fixed`, потому что иначе её режет
 * любой скроллящийся родитель: `overflow-x: auto` у таблицы обрезает и по
 * вертикали, и у нижних строк содержимое оказывалось недоступно.
 *
 * Плата за портал — панель не едет вместе со страницей, поэтому при прокрутке
 * и смене размера окна она закрывается. Пересчитывать положение на каждый
 * кадр дороже, чем закрыть.
 *
 * Общий хук, а не копия в каждом компоненте: этим пользуются и меню на три
 * точки, и календарь, и всё, что появится дальше.
 */
export function useAnchoredPanel(align: "start" | "end" = "end"): AnchoredPanel {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback((returnFocus = false) => {
    setIsOpen(false);
    setPosition(null);
    // Возврат фокуса на кнопку: иначе после Escape фокус уходит в никуда
    // и следующий Tab начинает обход страницы заново.
    if (returnFocus) anchorRef.current?.querySelector("button")?.focus();
  }, []);

  const toggle = useCallback(() => setIsOpen((open) => !open), []);

  // Положение считается после отрисовки панели: нужны её настоящие размеры,
  // чтобы понять, разворачивать вверх или вниз. Обычный useEffect, а не
  // useLayoutEffect: тот ругается при серверном рендере, а мигания нет —
  // до подсчёта панель скрыта через visibility.
  useEffect(() => {
    if (!isOpen) return;

    const anchor = anchorRef.current?.getBoundingClientRect();
    const panel = panelRef.current?.getBoundingClientRect();

    if (!anchor || !panel) return;

    const below = anchor.bottom + 4;
    const fitsBelow = below + panel.height + VIEWPORT_GAP <= window.innerHeight;
    const top = fitsBelow ? below : Math.max(VIEWPORT_GAP, anchor.top - panel.height - 4);
    const raw = align === "end" ? anchor.right - panel.width : anchor.left;
    const left = Math.min(
      Math.max(VIEWPORT_GAP, raw),
      Math.max(VIEWPORT_GAP, window.innerWidth - panel.width - VIEWPORT_GAP),
    );

    setPosition({ top, left });
  }, [isOpen, align]);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    const onViewportChange = () => close();

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

  return { isOpen, toggle, close, anchorRef, panelRef, position };
}
