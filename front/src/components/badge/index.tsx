import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";
import styles from "./style.module.scss";

export type BadgeTone = "neutral" | "success" | "danger";

export interface BadgeProps extends ComponentPropsWithoutRef<"span"> {
  /** Смысл цвета: успех, проблема или нейтральная пометка. */
  tone?: BadgeTone;
}

/**
 * Плашка статуса: «Проведён», «Черновик», «Закрыт».
 *
 * Цвет передаёт смысл, а не украшает — поэтому текст внутри обязателен:
 * одним цветом статус не прочитает тот, кто не различает красный и зелёный.
 */
export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return <span {...props} className={cn(styles.badge, styles[tone], className)} />;
}
