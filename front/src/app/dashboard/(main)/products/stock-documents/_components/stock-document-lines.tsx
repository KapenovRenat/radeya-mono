import { Trash2 } from "lucide-react";

import { Hint } from "@/components/hint";
import { Input } from "@/components/input";
import type { DraftLine } from "@/features/stock-documents/use-stock-document-draft";
import { tiynToTenge } from "@/features/stock-documents/stock-money";
import { formatMoneyExact, moneyToNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import styles from "./stock-documents.module.scss";

interface StockDocumentLinesProps {
  lines: DraftLine[];
  /** Оприходование: цена правится. Списание: цена — себестоимость, только показ. */
  isEnter: boolean;
  readOnly: boolean;
  onQuantityChange: (variantId: string, value: string) => void;
  onPriceChange: (variantId: string, value: string) => void;
  onRemove: (variantId: string) => void;
}

/**
 * Строки документа. Без пагинации: документ — это всё, что приехало
 * одной посадкой, и листать его по страницам неудобно.
 */
export function StockDocumentLines({ lines, isEnter, readOnly, onQuantityChange,
  onPriceChange, onRemove }: StockDocumentLinesProps) {
  if (lines.length === 0) {
    return <p className={styles.empty}>Товаров пока нет — нажмите «Добавить товары».</p>;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table} aria-label="Товары документа">
        <thead>
          <tr>
            <th scope="col">Фото</th>
            <th scope="col">Товар</th>
            <th scope="col">Артикул</th>
            <th scope="col" className={styles.numeric} title="Остаток на складе документа сейчас">Остаток</th>
            <th scope="col" className={styles.numeric}>Кол-во</th>
            <th scope="col" className={styles.numeric}>
              {isEnter ? (
                <span className={styles.headWithHint}>
                  Цена
                  <Hint align="end" label="Что значит цена"
                    text="Изменение цены перезапишет себестоимость товара — при проведении документа." />
                </span>
              ) : "Себестоимость"}
            </th>
            <th scope="col" className={styles.numeric}>Сумма</th>
            {!readOnly && <th scope="col"><span className={styles.srOnly}>Удалить</span></th>}
          </tr>
        </thead>

        <tbody>
          {lines.map((line) => {
            const { variant } = line;

            return (
              <tr key={variant.id} className={styles.row}>
                <td>
                  {variant.imageUrl ? (
                    // Не next/image: адреса картинок приходят из кабинета Kaspi.
                    <img className={styles.image} src={variant.imageUrl} alt="" width={48} height={48} loading="lazy" />
                  ) : (
                    <span className={styles.noImage}>нет фото</span>
                  )}
                </td>
                <td className={styles.name}>{variant.name}</td>
                <td className={styles.sku}>{variant.sku}</td>
                <td className={styles.numeric}>{variant.quantity ?? <span className={styles.muted}>—</span>}</td>

                <td className={styles.numeric}>
                  {readOnly ? line.quantity : (
                    <Input
                      inputMode="numeric"
                      aria-label={"Количество «" + variant.name + "»"}
                      value={line.quantity}
                      onChange={(event) => onQuantityChange(variant.id, event.target.value)}
                      className={styles.quantityInput}
                    />
                  )}
                </td>

                <td className={styles.numeric}>
                  {readOnly || !isEnter ? (
                    <PriceText value={line.effectivePrice} />
                  ) : (
                    <Input
                      inputMode="decimal"
                      aria-label={"Цена «" + variant.name + "»"}
                      placeholder="0"
                      value={line.price}
                      onChange={(event) => onPriceChange(variant.id, event.target.value)}
                      className={styles.priceInput}
                    />
                  )}
                </td>

                <td className={cn(styles.numeric, line.amountTiyn === null && styles.muted)}>
                  {line.amountTiyn === null ? "—" : formatMoneyExact(tiynToTenge(line.amountTiyn))}
                </td>

                {!readOnly && (
                  <td>
                    <button type="button" className={styles.iconButton} onClick={() => onRemove(variant.id)}
                      aria-label={"Убрать «" + variant.name + "» из документа"} title="Убрать из документа">
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Цена текстом. Пусто — прочерк: себестоимость у товара бывает не указана. */
function PriceText({ value }: { value: string | null }) {
  const number = moneyToNumber(value);

  return number === null ? <span className={styles.muted}>—</span> : <>{formatMoneyExact(number)}</>;
}
