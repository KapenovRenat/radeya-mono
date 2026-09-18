"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";
import styles from "./style.module.scss";

export interface CheckboxProps extends Omit<ComponentPropsWithoutRef<"input">, "type" | "children"> {
  /** Подпись рядом с галкой. Без неё обязателен `aria-label`: галка без подписи молчит. */
  label?: string;
  /**
   * Частичное состояние: выбрано не всё. Нужно для галки «выделить всё»
   * в шапке таблицы — иначе «выбрано 3 из 20» и «не выбрано ничего»
   * выглядят одинаково.
   */
  indeterminate?: boolean;
}

/**
 * Чекбокс поверх нативного input.
 *
 * Сам input остаётся в разметке и принимает фокус, только он визуально скрыт:
 * так бесплатно работают клавиатура, Space, `form`, `name` и чтение состояния
 * скринридером. Видимая часть — квадрат рядом, он же реагирует на `:checked`
 * через соседний селектор.
 */
export function Checkbox({ label, indeterminate = false, className, ...props }: CheckboxProps) {
  const input = useRef<HTMLInputElement>(null);

  // indeterminate живёт только в DOM: атрибутом его не задать.
  useEffect(() => {
    if (input.current) input.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label className={cn(styles.checkbox, props.disabled && styles.disabled, className)}>
      <input ref={input} type="checkbox" className={styles.input} {...props} />

      <span className={styles.box} aria-hidden="true">
        {indeterminate ? <Minus size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />}
      </span>

      {label && <span className={styles.label}>{label}</span>}
    </label>
  );
}
