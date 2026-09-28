import type { ImportRowProblem } from './imports';

/**
 * Поставщики: справочник и импорт из выгрузки контрагентов МойСклада.
 *
 * Импорт в два шага, как у продаж: предпросмотр разбирает файл и **ничего
 * не пишет**, запись берёт ровно те строки, которые человек увидел.
 */

/** Поставщик наружу. Полей немного — всё, что есть в выгрузке, плюс Telegram. */
export interface SupplierDto {
  id: string;

  /** UUID контрагента в МойСкладе. null — поставщик заведён руками. */
  externalId: string | null;

  name: string;
  address: string | null;
  phone: string | null;

  /** Проставляется руками: в выгрузке его нет. */
  telegramId: string | null;

  isActive: boolean;
  createdAt: string;
}

export interface SuppliersResponse {
  items: SupplierDto[];
}

/** Правка карточки руками. Прежде всего — Telegram, которого в файле нет. */
export interface UpdateSupplierRequest {
  name?: string;
  address?: string | null;
  phone?: string | null;
  telegramId?: string | null;
  isActive?: boolean;
}

/** Поле, где наше значение расходится с файлом. Импорт заполненное не перезаписывает. */
export interface SupplierDiff {
  field: 'name' | 'address' | 'phone';
  /** Что лежит у нас. */
  ours: string | null;
  /** Что пришло в файле. */
  file: string | null;
}

/** Разобранная строка выгрузки — будущий поставщик. */
export interface SupplierDraft {
  /** Номер строки в листе. По нему человек находит её глазами. */
  row: number;

  /**
   * UUID контрагента из первой колонки — ключ повторного импорта.
   *
   * В выгрузке он уникален на все пять с половиной тысяч строк, а наименования
   * дублируются сотнями, поэтому сверка идёт только по нему.
   */
  externalId: string | null;

  /** Наименование. Пусто — строку не записать. */
  name: string | null;
  address: string | null;
  phone: string | null;

  /** Такой `externalId` уже есть в базе: строка не создаст второго поставщика. */
  known: boolean;

  /** Чем наша запись отличается от файла. Пусто у новых. */
  diffs: SupplierDiff[];

  problems: ImportRowProblem[];
}

/** Ответ предпросмотра. В базу на этом шаге ничего не записано. */
export interface SupplierImportPreview {
  /** Все листы книги — человек выбирает, какой разбирать. */
  sheets: string[];
  /** Разобранный лист. null — файл прочитан, но лист ещё не выбран. */
  sheet: string | null;

  /** Строки группы поставщиков. */
  rows: SupplierDraft[];

  /** Строк на листе всего, не считая заголовка. */
  total: number;
  /** Отброшено: контрагент не из группы поставщиков. */
  filtered: number;
  /** Строк без наименования — записывать нечего. */
  invalid: number;
  /** Сколько из разобранных уже есть в базе. */
  known: number;
}

/** Запись разобранных строк. Едут именно те строки, что человек видел. */
export interface CommitSupplierImportRequest {
  /** Название листа — попадёт в журнал, чтобы знать, откуда взялись записи. */
  sheet: string;
  rows: SupplierDraft[];
}

export interface CommitSupplierImportResponse {
  /** Заведено новых поставщиков. */
  created: number;
  /** У существующих заполнены пустовавшие поля. */
  updated: number;
  /** Уже есть, дополнять нечем. */
  skipped: number;
  /** Строки, которые не удалось записать, и почему. */
  failed: { row: number; message: string }[];
}
