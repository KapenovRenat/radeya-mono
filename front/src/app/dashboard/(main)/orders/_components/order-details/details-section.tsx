import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import styles from "./style.module.scss";

/**
 * Блок окна заказа: заголовок и содержимое в рамке.
 * `wide` — во всю ширину сетки (состав, комментарии).
 */
export function DetailsSection({ title, wide = false, children }: {
  title: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cn(styles.section, wide && styles.wide)}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

/** Список пар «подпись — значение». Внутри — только `Field`. */
export function Fields({ children }: { children: ReactNode }) {
  return <dl className={styles.fields}>{children}</dl>;
}

/**
 * Пара «подпись — значение». Пустое значение — прочерк, а не пустота:
 * видно, что поле есть, а данных нет.
 */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  const empty = children === null || children === undefined || children === "" || children === false;

  return (
    <>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{empty ? <span className={styles.muted}>—</span> : children}</dd>
    </>
  );
}
