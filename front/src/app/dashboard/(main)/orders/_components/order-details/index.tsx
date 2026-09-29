"use client";

import { Button } from "@/components/button";
import { Loader } from "@/components/loader";
import { Modal } from "@/components/modal";
import { useOrderDetails } from "@/features/orders/use-order-details";
import { CommentsSection } from "./comments-section";
import { CustomerSection } from "./customer-section";
import { EntriesSection } from "./entries-section";
import { MoneySection } from "./money-section";
import { SummarySection } from "./summary-section";
import styles from "./style.module.scss";

/**
 * Окно заказа — только просмотр и комментарии.
 *
 * Собрано из блоков, каждый в своём файле этой папки: поменять содержимое
 * блока — править его файл, порядок блоков — здесь, общий вид — style.module.scss.
 *
 * `orderId === null` — окно закрыто.
 */
export function OrderDetailsModal({ orderId, onClose }: {
  orderId: string | null;
  onClose: () => void;
}) {
  const details = useOrderDetails(orderId);
  const { order } = details;

  return (
    <Modal
      open={orderId !== null}
      onClose={onClose}
      title={order !== null ? `Заказ ${order.code}` : "Заказ"}
      className={styles.dialog}
    >
      {order === null && details.isLoading && (
        <div className={styles.state}>
          <Loader size={28} hideLabel />
          Загружаю заказ…
        </div>
      )}

      {order === null && details.error !== null && (
        <div className={styles.state}>
          <span role="alert" className={styles.error}>{details.error}</span>
          <Button className="" type="button" onClick={() => void details.reload()}>Повторить</Button>
        </div>
      )}

      {order !== null && orderId !== null && (
        <div className={styles.layout}>
          <SummarySection order={order} />
          <CustomerSection order={order} />
          <MoneySection order={order} />
          <EntriesSection
            order={order}
            isLoading={details.isLoadingEntries}
            error={details.entriesError}
            onRetry={details.retryEntries}
          />
          <CommentsSection orderId={orderId} />
        </div>
      )}
    </Modal>
  );
}
