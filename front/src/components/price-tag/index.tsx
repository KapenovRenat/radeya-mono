import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";
import styles from "./style.module.scss";

interface PriceTagProps extends ComponentProps<"div"> {
  /** Цена в тенге. */
  price: number;
  /** Старая цена — если есть, показывается зачёркнутой. */
  oldPrice?: number;
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("ru-KZ", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(value);

/**
 * Ценник товара. Компонент общий: и для витрины, и для админки.
 * Внешний вид задаёт тема раздела через токены, точечные правки —
 * className снаружи.
 */
export function PriceTag({
  price,
  oldPrice,
  className,
  ...props
}: PriceTagProps) {
  const discount =
    oldPrice && oldPrice > price
      ? Math.round((1 - price / oldPrice) * 100)
      : null;

  return (
    <div className={cn(styles.priceTag, className)} {...props}>
      <span className={styles.current}>{formatPrice(price)}</span>

      {oldPrice && <span className={styles.old}>{formatPrice(oldPrice)}</span>}

      {discount && <span className={styles.badge}>−{discount}%</span>}
    </div>
  );
}
