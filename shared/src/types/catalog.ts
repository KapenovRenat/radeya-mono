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
export interface RenameCategoryRequest { name: string }
export interface DeleteCategoryResponse { id: string }

export interface CatalogQuery {
  page?: number;
  pageSize?: CatalogPageSize;
  search?: string;
  /** Выбранная папка вместе с подпапками. Без поля — весь каталог. */
  categoryId?: string;
}
export interface CatalogListingDto {
  id: string;
  channel: SalesChannel;
  status: ListingStatus;
  /** Точные десятичные значения в тенге, например "149990.00". */
  price: string | null;
  discountPrice: string | null;
  discountPercent: number;
  /** Идентификатор предложения на площадке: Kaspi `offerId`, OZON `product_id`. */
  externalId: string | null;
  /** Идентификатор карточки площадки: Kaspi `masterSku`. */
  externalSku: string | null;
  externalUrl: string | null;
  /** ISO-строки. Даты наружу везде идут строками — JSON другого формата не знает. */
  publishedAt: string | null;
  lastSyncedAt: string | null;
  /** Почему последняя синхронизация не прошла. Пусто — прошла. */
  syncError: string | null;
}
export interface CatalogStockDto {
  warehouse: {
    id: string;
    code: string;
    name: string | null;
    /** `6871008_PP3` — по нему матчатся заказы Kaspi. */
    kaspiStoreId: string;
    /** Код города по КАТО. У части складов пусто — заполняется руками. */
    kaspiCityId: string | null;
    isActive: boolean;
  };
  quantity: number | null;
  preOrderDays: number;
}
/** Картинка карточки Kaspi: готовые адреса трёх размеров. */
export interface CatalogImageDto {
  small: string | null;
  medium: string | null;
  large: string | null;
}
/** Поля кабинета Kaspi. Пишет только синхронизация, руками не правятся. */
export interface CatalogKaspiDto {
  /** Название карточки на витрине — синяя ссылка в кабинете. */
  masterTitle: string | null;
  /** Наше название в кабинете — серая строка под ссылкой. */
  title: string | null;
  /** Поле `model` кабинета. Обычно повторяет `title`, но не всегда. */
  model: string | null;
  masterSku: string | null;
  offerId: string | null;
  fileId: string | null;
  merchantUid: string | null;
  shopLink: string | null;
  /** Когда кабинет последний раз менял товар. */
  updatedAt: string | null;
  /**
   * Снимок истории изменений из кабинета, как её отдаёт Kaspi. Формат
   * недокументированный, поэтому отдаётся сырым: разбирать наугад нельзя.
   */
  updates: unknown[];
}
/** Четыре флага — зеркало кабинета. Пятый, `site`, наш: заказ с сайта везём сами. */
export interface CatalogDeliveryDto {
  any: boolean;
  express: boolean;
  local: boolean;
  merchant: boolean;
  site: boolean;
}
/**
 * Одна строка = одна модификация. Категория общая для всех модификаций Product.
 *
 * DTO дашборда, не витрины: содержит закупочную цену. На страницы магазина
 * не отдавать. Эндпоинт закрыт ролью ADMIN целиком — когда появятся MANAGER
 * и SELLER, `purchasePrice` нужно срезать по роли, а не открывать всем.
 */
export interface CatalogRowDto {
  variantId: string;
  productId: string;
  name: string;
  sku: string;
  barcode: string | null;
  brand: string | null;
  category: { id: string; name: string } | null;
  /** Первая пригодная ссылка из `images` — превью для таблицы. */
  imageUrl: string | null;
  images: CatalogImageDto[];
  /** Наше решение продавать, одно на все каналы. Не путать с `listings[].status`. */
  status: ListingStatus;
  productIsActive: boolean;
  fabric: { id: string; name: string; code: string; type: string | null } | null;
  fabricShade: {
    id: string;
    name: string;
    code: string;
    hex: string | null;
    imageUrl: string | null;
  } | null;
  listings: CatalogListingDto[];
  stocks: CatalogStockDto[];

  /** Сумма остатков по складам. Пустой остаток считается нулём. */
  totalStock: number;
  /** Максимальный срок предзаказа по складам. Ноль — товар в наличии. */
  preOrderDays: number;

  /** Закупка. Внутреннее поле дашборда — см. комментарий к типу. */
  purchasePrice: string | null;
  /** Минимум и максимум по каналам: денормализация под сортировку и фильтр. */
  minChannelPrice: string | null;
  maxChannelPrice: string | null;

  kaspi: CatalogKaspiDto;
  delivery: CatalogDeliveryDto;

  /** Поля карточки модели: у всех модификаций одного Product они общие. */
  product: {
    slug: string | null;
    description: string | null;
    /** `familyId` кабинета как есть, ключ склейки модификаций одной модели. */
    kaspiFamilyId: string | null;
    createdAt: string;
    updatedAt: string;
  };

  sortOrder: number;
  createdAt: string;
  updatedAt: string;
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
