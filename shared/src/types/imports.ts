/**
 * Импорт офлайн-заказов из книги Excel.
 *
 * Два шага, как у синхронизации каталога: сначала предпросмотр — файл разобран,
 * показано что получилось, в базу ничего не записано; потом запись именно того,
 * что человек увидел. Импорт, который пишет сразу, однажды зальёт в заказы
 * чужую таблицу, а откатывать это будет нечем.
 */

/** Что не удалось разобрать в строке. Строка с проблемой не пропадает — её видно в предпросмотре. */
export interface ImportRowProblem {
  /** Заголовок колонки, к которой относится замечание. Пусто — замечание про строку целиком. */
  column: string | null;
  message: string;
}

/**
 * Значение справочника, встреченное в файле.
 *
 * Не нашлось в списке — строка всё равно разбирается, а значение едет сюда:
 * человек решает, добавить его в справочник или это опечатка. Отклонять
 * строку из-за нового способа оплаты нельзя — списки на то и пополняемые.
 */
export interface ImportUnknownValue {
  kind: string;
  value: string;
  /** Сколько раз встретилось в файле. */
  count: number;
}

/** Разобранная строка файла — будущий офлайн-заказ. */
export interface OfflineOrderDraft {
  /** Номер строки в листе Excel. По нему человек находит строку глазами. */
  row: number;

  /** Когда оформлен. Пусто — строка не будет записана. */
  placedAt: string | null;
  plannedDeliveryAt: string | null;

  /** Номер, записанный руками. Не уникален и ключом не служит. */
  externalNumber: string | null;

  totalPrice: string | null;
  paidAmount: string | null;
  /** Ноль означает «оплачено» — отдельного статуса для этого нет. */
  balanceDue: string | null;

  discountPercent: number | null;
  discountComment: string | null;

  /** Идентификаторы значений справочников. null — значение в списке не нашлось. */
  customerSourceId: string | null;
  deliveryStatusId: string | null;
  shipmentOriginId: string | null;
  paymentMethodId: string | null;

  /** Те же значения текстом, как в файле, — чтобы было видно, что именно не нашлось. */
  customerSourceText: string | null;
  deliveryStatusText: string | null;
  shipmentOriginText: string | null;
  paymentMethodText: string | null;

  customerName: string | null;
  customerPhone: string | null;
  deliveryTown: string | null;
  deliveryFormattedAddress: string | null;

  /** Позиция заказа: название из файла и всё, что о товаре дописали. */
  productName: string | null;
  productNote: string | null;

  /** «Важные комментарии» из файла — уедут в ленту комментариев заказа. */
  comment: string | null;
  /** «Чей рабочий день»: продавца ставит админ руками, имя сохраняем подсказкой. */
  sellerHint: string | null;

  problems: ImportRowProblem[];
}

/** Ответ предпросмотра. В базу на этом шаге ничего не записано. */
export interface OfflineImportPreview {
  /** Все листы книги — человек выбирает, какой разбирать. */
  sheets: string[];
  /** Разобранный лист. null — файл прочитан, но лист ещё не выбран. */
  sheet: string | null;

  rows: OfflineOrderDraft[];
  /** Строк, пропущенных как пустые или служебные. */
  skipped: number;
  /** Строк, которые не получится записать: нет даты или суммы. */
  invalid: number;
  /** Значения, которых нет в справочниках. */
  unknownValues: ImportUnknownValue[];
  /** Колонки файла, которые импорт не использует. */
  ignoredColumns: string[];
}

/** Запись разобранных строк. Едут именно те строки, что человек видел в предпросмотре. */
export interface CommitOfflineImportRequest {
  salesPointId: string;
  /** Название листа — попадёт в комментарий заказа, чтобы знать, откуда он взялся. */
  sheet: string;
  rows: OfflineOrderDraft[];
}

export interface CommitOfflineImportResponse {
  created: number;
  /** Строки, которые не удалось записать, и почему. */
  failed: { row: number; message: string }[];
}
