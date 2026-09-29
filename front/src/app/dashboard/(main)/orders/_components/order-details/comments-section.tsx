import { USER_ROLE_LABELS } from "@radeya/shared";

import { Button } from "@/components/button";
import { Loader } from "@/components/loader";
import { useOrderComments } from "@/features/orders/use-order-comments";
import { formatDateTime } from "@/lib/format";
import { DetailsSection } from "./details-section";
import styles from "./style.module.scss";

/** Лента комментариев: старые сверху, новый — снизу. Правок и удалений нет. */
export function CommentsSection({ orderId }: { orderId: string }) {
  const comments = useOrderComments(orderId);

  return (
    <DetailsSection title="Комментарии" wide>
      {comments.isLoading && <Loader size={24} hideLabel />}
      {comments.loadError && <p role="alert" className={styles.error}>{comments.loadError}</p>}

      {!comments.isLoading && comments.items.length === 0 && !comments.loadError && (
        <p className={styles.muted}>Комментариев пока нет.</p>
      )}

      {comments.items.length > 0 && (
        <ul className={styles.comments}>
          {comments.items.map((comment) => (
            <li key={comment.id} className={styles.comment}>
              <div className={styles.commentHead}>
                <span className={styles.commentAuthor}>{comment.authorName}</span>
                <span>{USER_ROLE_LABELS[comment.authorRole]}</span>
                <span>{formatDateTime(comment.createdAt)}</span>
              </div>
              <p className={styles.commentText}>{comment.text}</p>
            </li>
          ))}
        </ul>
      )}

      <form
        className={styles.commentForm}
        onSubmit={(event) => {
          event.preventDefault();
          void comments.send();
        }}
      >
        <label className="sr-only" htmlFor={`order-comment-${orderId}`}>Новый комментарий</label>
        <textarea
          id={`order-comment-${orderId}`}
          className={styles.textarea}
          value={comments.text}
          maxLength={comments.maxLength}
          placeholder="Комментарий к заказу"
          disabled={comments.isSending}
          onChange={(event) => comments.setText(event.target.value)}
        />

        {comments.error && <p role="alert" className={styles.error}>{comments.error}</p>}

        <div className={styles.formFooter}>
          <span>{comments.text.length} / {comments.maxLength}</span>
          <Button className="" type="submit"
            disabled={comments.isSending || comments.text.trim() === ""}>
            {comments.isSending ? "Отправляю…" : "Добавить"}
          </Button>
        </div>
      </form>
    </DetailsSection>
  );
}
