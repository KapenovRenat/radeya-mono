import type { CatalogPageSize } from '../constants/catalog';
import type { ListingStatus, SalesChannel } from '../constants/sales-channels';
import type { PaginatedResponse } from './api';

export interface CategoryDto {
  id: string;
  name: string;
  parentId: string | null;
}
export interface CategoryTreeNode extends CategoryDto {
  children: CategoryTreeNode[];
}
export interface CategoryTreeResponse {
  /** Служебный пункт, не запись Category. null означает отсутствие фильтра. */
  allProducts: { id: null; name: string };
  items: CategoryTreeNode[];
}
export interface CreateCategoryRequest {
  name: string;
  /** null или отсутствие поля — папка верхнего уровня. */
  parentId?: string | null;
}
export interface CatalogQuery {
  page?: number;
  pageSize?: CatalogPageSize;
  search?: string;
  /** Выбранная папка вместе с подпапками. Без поля — весь каталог. */
  categoryId?: string;
}
export interface CatalogListingDto {
  channel: SalesChannel;
  status: ListingStatus;
  /** Точные десятичные значения в тенге, например "149990.00". */
  price: string | null;
  discountPrice: string | null;
  discountPercent: number;
}
export interface CatalogStockDto {
  warehouse: { id: string; code: string; name: string | null };
  quantity: number | null;
  preOrderDays: number;
}
/** Одна строка = одна модификация. Категория общая для всех модификаций Product. */
export interface CatalogRowDto {
  variantId: string;
  productId: string;
  name: string;
  sku: string;
  barcode: string | null;
  brand: string | null;
  category: { id: string; name: string } | null;
  imageUrl: string | null;
  status: ListingStatus;
  productIsActive: boolean;
  fabric: { id: string; name: string } | null;
  fabricShade: { id: string; name: string } | null;
  listings: CatalogListingDto[];
  stocks: CatalogStockDto[];
}
/** total считает артикулы после поиска и фильтра по папке. */
export interface CatalogResponse extends PaginatedResponse<CatalogRowDto> {
  totalPages: number;
}
export interface MoveProductsRequest {
  productIds: string[];
  /** null снимает привязку к папке; товар остаётся в «Все товары». */
  categoryId: string | null;
}
export interface MoveProductsResponse { updated: number }
