/**
 * Словарь истории изменений: какие сущности ведут историю и как в интерфейсе
 * подписаны их поля.
 *
 * В базе запись истории хранит ключ поля (`name`), а не подпись («Название»).
 * Подпись берётся отсюда при показе. Иначе переименование подписи разделило бы
 * историю надвое: старые записи со старым словом, новые с новым, и фильтр
 * «все изменения названия» находил бы половину.
 *
 * Ключ, однажды попавший в историю, не переименовывать и не удалять: старые
 * записи ссылаются на него. Поле убрали из модели — подпись остаётся здесь.
 */

/** Сущности с историей. Значения совпадают с именами моделей Prisma и `AuditLog.entityType`. */
export const HISTORY_ENTITY_TYPES = {
  PRODUCT: 'Product',
  VARIANT: 'Variant',
  SUPPLIER: 'Supplier',
} as const;

export type HistoryEntityType = (typeof HISTORY_ENTITY_TYPES)[keyof typeof HISTORY_ENTITY_TYPES];

/**
 * Откуда пришло изменение. Значения совпадают с enum `ChangeSource` в schema.prisma.
 *
 * Отдельно от автора: импорт запускает человек, но цифры в него положил файл,
 * и «renat поставил закупку 150 000» без пометки «импортом» читалось бы
 * как ручная правка.
 */
export const HISTORY_SOURCES = {
  MANUAL: 'MANUAL',
  IMPORT: 'IMPORT',
  KASPI_SYNC: 'KASPI_SYNC',
} as const;

export type HistorySource = (typeof HISTORY_SOURCES)[keyof typeof HISTORY_SOURCES];

export const HISTORY_SOURCE_LABELS: Record<HistorySource, string> = {
  MANUAL: 'вручную',
  IMPORT: 'импорт',
  KASPI_SYNC: 'синхронизация Kaspi',
};

/**
 * Подписи полей по сущностям.
 *
 * Ссылки на другие записи названы без `Id` (`supplier`, а не `supplierId`):
 * в историю пишется название снимком, а не UUID. UUID в строке «было → стало»
 * ничего не говорит человеку, а по названию на момент правки видно, что именно
 * выбрали, даже если поставщика потом переименовали.
 *
 * Поля склада (`quantity`, `reserved`, `expected`, `preOrderDays`) живут у артикула:
 * склад пишется в контекст записи, а не в имя поля — иначе на каждый склад
 * пришлось бы заводить свой ключ.
 */
export const HISTORY_FIELD_LABELS = {
  Product: {
    name: 'Название',
    brand: 'Бренд',
    description: 'Описание',
    category: 'Папка',
    isActive: 'Активен',
  },
  Variant: {
    sku: 'Артикул',
    barcode: 'Штрихкод',
    status: 'Статус продажи',
    purchasePrice: 'Закупка',
    purchaseCurrency: 'Валюта закупки',
    costPrice: 'Себестоимость',
    supplier: 'Поставщик',
    fabric: 'Ткань',
    fabricShade: 'Оттенок',
    siteDelivery: 'Доставка с сайта',
    quantity: 'Остаток',
    reserved: 'Резерв',
    expected: 'Ожидание',
    preOrderDays: 'Срок предзаказа',
  },
  Supplier: {
    name: 'Название',
    address: 'Адрес',
    phone: 'Телефон',
    telegramId: 'Telegram ID',
    isActive: 'Активен',
  },
} as const satisfies Record<HistoryEntityType, Record<string, string>>;

/** Допустимые ключи полей для сущности: опечатка в ключе не скомпилируется. */
export type HistoryField<E extends HistoryEntityType> = keyof (typeof HISTORY_FIELD_LABELS)[E] & string;

/**
 * Подпись поля для показа. Незнакомый ключ возвращается как есть, а не роняет
 * страницу: история старше словаря должна открываться всегда.
 */
export function historyFieldLabel(entityType: string, field: string): string {
  const labels = (HISTORY_FIELD_LABELS as Record<string, Record<string, string>>)[entityType];

  return labels?.[field] ?? field;
}
