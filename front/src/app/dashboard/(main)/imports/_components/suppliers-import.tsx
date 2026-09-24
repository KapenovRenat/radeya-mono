"use client";

import styles from "./style.module.scss";

/**
 * Импорт данных поставщиков — место под будущий блок.
 *
 * Заглушка стоит здесь намеренно: раздел задуман как набор независимых блоков,
 * и пустая рамка показывает это устройство сразу, не дожидаясь второго импорта.
 */
export function SuppliersImport() {
  return (
    <section className={styles.block} aria-labelledby="import-suppliers">
      <div className={styles.blockHead}>
        <h2 id="import-suppliers" className={styles.blockTitle}>
          Поставщики
        </h2>
        <p className={styles.blockHint}>Будет позже</p>
      </div>

      <p className={styles.soon}>
        Здесь появится разбор прайсов и накладных поставщиков. Блок независим
        от импорта продаж: свой файл, свой предпросмотр, своя запись.
      </p>
    </section>
  );
}
