"use client";

import { useEffect, useState } from "react";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";
import styles from "./style.module.scss";

export interface LoaderProps extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
  label?: string;
  /** Диаметр кольца: число в пикселях или CSS-размер, например "2rem". */
  size?: number | string;
  /** Скрывает видимый текст, сохраняя подпись для скринридера. */
  hideLabel?: boolean;
}

const LETTER_STEP_MS = 160;

export function Loader({
  label = "Загрузка ...",
  size = "1.25em",
  hideLabel = false,
  className,
  ...props
}: LoaderProps) {
  const letters = Array.from(label);
  const letterCount = letters.length;
  const [highlight, setHighlight] = useState({ label, index: 0 });
  const activeIndex = highlight.label === label ? highlight.index : 0;

  useEffect(() => {
    if (hideLabel || letterCount < 2) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | undefined;

    const syncAnimation = () => {
      clearInterval(timer);
      timer = undefined;
      if (reducedMotion.matches) return;

      timer = setInterval(() => {
        setHighlight((previous) => ({
          label,
          index: ((previous.label === label ? previous.index : 0) + 1) % letterCount,
        }));
      }, LETTER_STEP_MS);
    };

    syncAnimation();
    reducedMotion.addEventListener("change", syncAnimation);
    return () => {
      clearInterval(timer);
      reducedMotion.removeEventListener("change", syncAnimation);
    };
  }, [label, letterCount, hideLabel]);

  return (
    <span
      role="status"
      aria-live="polite"
      aria-atomic="true"
      {...props}
      className={cn(styles.loader, className)}
    >
      <span
        className={styles.spinner}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
      <span className={styles.accessibleLabel}>{label}</span>
      {!hideLabel && (
        <span className={styles.label} aria-hidden="true">
          {letters.map((letter, index) => (
            <span
              key={index}
              className={cn(index === activeIndex && styles.letterActive)}
            >
              {letter}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
