"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import styles from "./style.module.scss";

export interface ModalProps {
  /** Управляется снаружи: состояние окна живёт в родителе, а не внутри. */
  open: boolean;
  /**
   * Зовётся на любое закрытие: крестик, Escape, клик по подложке.
   * Родитель обязан по нему поставить `open = false`, иначе окно больше
   * не откроется — `<dialog>` уже закрыт, а пропс говорит обратное.
   */
  onClose: () => void;
  /** Заголовок шапки. Он же озвучивается скринридером как имя окна. */
  title: ReactNode;
  children: ReactNode;
  /** Подвал под телом: обычно кнопки. Нет — не рисуется вовсе. */
  footer?: ReactNode;
  /** Ширину задаёт вызывающий: у формы и у таблицы она разная. */
  className?: string;
}

/**
 * Модальное окно.
 *
 * На нативном `<dialog>`: он сам даёт ловушку фокуса, закрытие по Escape,
 * подложку и возврат фокуса на кнопку, которая окно открыла. Своя реализация
 * на `div` потребовала бы всего этого руками, и про клавиатуру в ней обычно
 * забывают.
 *
 * Все способы закрытия сходятся в одну точку — событие `close` самого диалога.
 * Поэтому «что делать при закрытии» описано один раз, а не по разу на крестик,
 * Escape и клик мимо окна.
 */
export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  /**
   * Где нажали кнопку мыши.
   *
   * Без этого выделение текста в окне закрывало бы его: если отпустить кнопку
   * над подложкой, браузер отправит `click` на сам `<dialog>`, и проверка
   * «кликнули мимо» сработает ложно. Закрываем, только когда и нажатие,
   * и отпускание пришлись на подложку.
   */
  const pressedOnBackdrop = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    // showModal() на уже открытом диалоге бросает исключение, close() на
    // закрытом молча ничего не делает — проверяем оба случая одинаково.
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  /**
   * Фон не прокручивается, пока окно открыто.
   *
   * `showModal()` делает остальную страницу неактивной, но прокрутку не
   * запрещает: без этого колесо мыши над подложкой уезжает по странице позади.
   */
  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onMouseDown={(event) => {
        pressedOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        // У нативного диалога подложка не отдельный элемент: клик по ней
        // приходит на сам <dialog>. Поэтому у него нет внутренних отступов —
        // иначе клик по полю формы считался бы кликом мимо окна.
        if (pressedOnBackdrop.current && event.target === event.currentTarget) {
          dialogRef.current?.close();
        }

        pressedOnBackdrop.current = false;
      }}
      className={cn(styles.modal, className)}
    >
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>{title}</h2>

        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Закрыть"
          className={styles.close}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.body}>{children}</div>

      {footer !== undefined && <div className={styles.footer}>{footer}</div>}
    </dialog>
  );
}
