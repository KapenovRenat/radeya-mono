"use client";

import { useId } from "react";
import { CircleHelp } from "lucide-react";

import { cn } from "@/lib/utils";
import styles from "./style.module.scss";

export interface HintProps {
  /** Текст подсказки. */
  text: string;
  /** Подпись значка для скринридера: «вопросительный знак» ничего не говорит. */
  label?: string;
  /** С какого края значка выравнивать подсказку: у правой колонки — по правому. */
  align?: "start" | "end";
  className?: string;
}

/**
 * Значок «?» с подсказкой по наведению и по фокусу с клавиатуры.
 *
 * Не `title`: его не видно с клавиатуры и на тач-экране, и браузер показывает
 * его с задержкой. Подсказка открывается вниз — в таблице с горизонтальной
 * прокруткой открытая вверх обрезалась бы краем таблицы.
 */
export function Hint({ text, label = "Подсказка", align = "start", className }: HintProps) {
  const id = useId();

  return (
    <span className={cn(styles.hint, className)}>
      <button type="button" className={styles.trigger} aria-label={label} aria-describedby={id}>
        <CircleHelp size={14} aria-hidden="true" />
      </button>
      <span id={id} role="tooltip" className={cn(styles.tooltip, align === "end" && styles.alignEnd)}>
        {text}
      </span>
    </span>
  );
}
