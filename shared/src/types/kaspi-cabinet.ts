import type { ListingStatus } from '../constants/marketplaces';

/**
 * Загрузка каталога из кабинета Kaspi (внутренний JSON, не XML-выгрузка).
 *
 * В базу пока ничего не пишется — только показ на странице.
 * Подробности источника — раздел 10 в docs/kaspi-api-integration.md.
 */

/**
 * Товар из кабинета в нашем виде.
 *
 * Сырой ответ наружу не отдаём: в нём около трёхсот записей цен по городам
 * на каждый товар, а нужна из них одна. Здесь только то, что показываем.
 */
export interface CabinetOffer {
  /** Наш артикул. Ключ сопоставления с XML и позициями заказов. */
  sku: string;
  /** Идентификатор карточки в каталоге Kaspi. */
  masterSku: string | null;
  /** Идентификатор нашего предложения — понадобится для смены цен. */
  offerId: string | null;

  /** Наше название, из выгрузки. В кабинете — серая строка под ссылкой. */
  title: string;
  /** Название карточки на витрине Kaspi. В кабинете — синяя ссылка. */
  masterTitle: string | null;
  brand: string | null;

  /** Основная цена. В данных Kaspi это `oldPrice`, когда есть скидка. */
  price: number | null;
  /** Цена со скидкой. Пусто — скидки нет. */
  discountPrice: number | null;
  /** Процент, посчитанный самим Kaspi. Ноль — скидки нет. */
  discountPercent: number;

  /** Штрихкод (`ntin`). Есть не у всех. */
  barcode: string | null;

  /** Превью — первая картинка в маленьком размере. */
  imageUrl: string | null;
  /** Сколько картинок всего. */
  imagesCount: number;

  status: ListingStatus;

  /** Коды складов: `PP3`, `PP4`. */
  warehouses: string[];
  /** Сумма остатков по складам. */
  totalStock: number;
  /** Максимальный срок предзаказа в днях. Ноль — товар в наличии. */
  preOrderDays: number;

  /** Путь категорий от общего к частному. */
  categoryPath: string[];
  /** Ключ группировки модификаций одной модели. Как есть, без разбора. */
  familyId: string | null;
  /** Размер в сантиметрах — числовая скобка из `familyId`. */
  sizeCm: number | null;

  /** Путь на витрину Kaspi. */
  shopLink: string | null;
  updatedAt: string | null;

  /** Что не удалось разобрать. Пустой массив — запись в порядке. */
  problems: string[];
}

export interface KaspiCabinetFetchRequest {
  /**
   * Кука сессии кабинета целиком, как в заголовке Cookie.
   * Пусто — берём ранее запомненную. Сервер её нигде не сохраняет на диск.
   */
  cookie?: string;

  /** Держать куку в памяти процесса до перезапуска сервера. */
  remember?: boolean;
}

export interface KaspiCabinetFetchResponse {
  /** Сколько товаров получили всего — оба режима вместе. */
  total: number;

  /** Из них в продаже. */
  onSale: number;

  /** Из них снятых с продажи. */
  offSale: number;

  /**
   * Сколько товаров обещал кабинет (поле `total` в его ответе), сумма по обоим
   * режимам. Расходится с `total` — обход что-то потерял.
   */
  expected: number | null;

  /** Сколько страниц успели пройти. */
  pages: number;

  /**
   * Номер страницы, на которой прервались, либо null — дошли до конца.
   * Обычно означает, что кука протухла посреди обхода.
   */
  stoppedAtPage: number | null;

  /** Текст ошибки, если обход прервался. */
  stoppedReason: string | null;

  /** Лежит ли сейчас в памяти сервера запомненная кука. */
  hasStoredCookie: boolean;

  /** Сколько записей не удалось разобрать полностью. */
  withProblems: number;

  /** Все полученные товары — оба режима в одном списке. */
  offers: CabinetOffer[];
}
