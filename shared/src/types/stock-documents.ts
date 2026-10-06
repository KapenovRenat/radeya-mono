import type { CatalogPageSize } from '../constants/catalog';
import type { StockDocumentType } from '../constants/stock-documents';
import type { PaginatedResponse } from './api';

/**
 * Документы склада: оприходование и списание. Деньги — строками с двумя
 * знаками (`"120000.00"`), даты — ISO-строками, как во всём API.
 */

export interface StockDocumentPersonDto {
  id: string;
  name: string;
}

export interface StockDocumentWarehouseDto {
  id: string;
  code: string;
  name: string | null;
}

/** Строка списка документов. */
export interface StockDocumentListItemDto {
  id: string;
  /** Число; на экран — через formatStockDocumentNumber(): `00128`. */
  number: number;
  type: StockDocumentType;
  warehouse: StockDocumentWarehouseDto;
  comment: string | null;
  /** Σ количество × цена, тенге. */
  totalAmount: string;
  linesCount: number;
  /** Пусто — черновик: остатки не тронуты. */
  postedAt: string | null;
  postedBy: StockDocumentPersonDto | null;
  createdBy: StockDocumentPersonDto;
  createdAt: string;
  updatedAt: string;
}

export interface StockDocumentListQuery {
  page?: number;
  pageSize?: CatalogPageSize;
  type?: StockDocumentType;
  warehouseId?: string;
  /** Номер целиком: `128` или `00128`. */
  number?: string;
}

export interface StockDocumentListResponse extends PaginatedResponse<StockDocumentListItemDto> {
  totalPages: number;
}

/**
 * Товар для документа: в окне выбора и в строке документа.
 * `quantity` — остаток на складе документа сейчас; null — товар на склад
 * не назначен или остаток не указан.
 */
export interface StockVariantDto {
  id: string;
  sku: string;
  name: string;
  imageUrl: string | null;
  /** Себестоимость за единицу, тенге. Подставляется ценой в оприходование. */
  costPrice: string | null;
  quantity: number | null;
}

export interface StockDocumentLineDto {
  id: string;
  variant: StockVariantDto;
  quantity: number;
  price: string;
  amount: string;
}

export interface StockDocumentDto extends StockDocumentListItemDto {
  lines: StockDocumentLineDto[];
}

export interface StockDocumentLineInput {
  variantId: string;
  quantity: number;
  /**
   * Цена за единицу: `"120000.00"`. Обязательна у оприходования. У списания
   * не передаётся — сервер берёт себестоимость товара.
   */
  price?: string;
}

/**
 * Создание и правка черновика: документ целиком, строки — полным списком.
 * `post: true` — галочка «Проведено»: записать и провести одной транзакцией
 * (только STOCK_DOCUMENT_POST_ROLES).
 */
export interface SaveStockDocumentRequest {
  type: StockDocumentType;
  warehouseId: string;
  /** Обязателен: от STOCK_DOCUMENT_COMMENT_MIN_LENGTH символов. */
  comment: string;
  lines: StockDocumentLineInput[];
  post?: boolean;
}

export interface StockPickerQuery {
  /** Склад документа — для колонки «Остаток» в окне выбора. */
  warehouseId: string;
  search?: string;
  page?: number;
}

export interface StockPickerResponse extends PaginatedResponse<StockVariantDto> {
  totalPages: number;
}
