# index.md — живое оглавление Radeya

> Точка входа в проект. Обновляется после каждого значимого изменения в коде или `docs/`.
> Правила работы — в [AGENTS.md](AGENTS.md). Текущее состояние — в [STATUS.md](STATUS.md).

---

## 1. Карта приложения

> Полный перечень того, что уже существует в коде. Ведётся по правилам раздела
> «Карта проекта и работа после /clear» в [AGENTS.md](AGENTS.md).
> Пустая таблица означает, что сущностей этого типа в коде ещё нет — не «не задокументировано».

### Структура пакетов

```
server/    # Express + Prisma + PostgreSQL — API
front/     # Next.js (App Router) — магазин + dashboard
shared/    # Общий код: типы контрактов, константы, утилиты
```

Детальная структура папок — в [docs/architecture.md](docs/architecture.md).

### 1.1. API-эндпоинты

Базовый префикс — `/api`.

| Метод и путь | Назначение | Auth | Файл |
|---|---|---|---|
| `GET /api/health` | Сервер жив + база отвечает (503 при недоступной базе) | нет | `server/src/modules/health/health.routes.ts` |
| `POST /api/auth/login` | Вход по логину и паролю, ставит httpOnly-куку сессии | нет | `server/src/modules/auth/auth.routes.ts` |
| `POST /api/auth/logout` | Завершение сессии, удаление куки | да | `server/src/modules/auth/auth.routes.ts` |
| `GET /api/auth/me` | Текущий пользователь | да | `server/src/modules/auth/auth.routes.ts` |
| `GET /api/users` | Список сотрудников | ADMIN | `server/src/modules/users/users.routes.ts` |
| `POST /api/users` | Создание сотрудника | ADMIN | `server/src/modules/users/users.routes.ts` |
| `GET /api/audit` | Журнал действий и история изменений, постранично; фильтры по сущности (`entityType` + `entityId`) и типу (`action`) | ADMIN | `server/src/modules/audit/audit.controller.ts` |
| `POST /api/kaspi-catalog/preview` | Разбор выгрузок ACTIVE/ARCHIVE, без записи в БД | ADMIN | `server/src/modules/kaspi-catalog/kaspi-catalog.routes.ts` |
| `POST /api/kaspi-catalog/fetch` | Обход каталога в кабинете Kaspi: товары и сводка складов, без записи в БД | ADMIN | `server/src/modules/kaspi-catalog/kaspi-catalog.routes.ts` |
| `GET /api/warehouses` | Справочник складов | ADMIN | `server/src/modules/warehouses/warehouses.routes.ts` |
| `POST /api/warehouses/import-kaspi` | Импорт складов из предпросмотра выгрузки, повторяемый | ADMIN | `server/src/modules/warehouses/warehouses.routes.ts` |
| `GET /api/products/skus` | Артикулы, уже сохранённые в каталоге | ADMIN | `server/src/modules/products/products.routes.ts` |
| `POST /api/products/import-kaspi` | Сохранение загруженных товаров в каталог; создаёт только новые | ADMIN | `server/src/modules/products/products.routes.ts` |
| `GET /api/categories` | Дерево ручных папок и служебный пункт «Все товары» | ADMIN | `server/src/modules/categories/categories.controller.ts` |
| `POST /api/categories` | Создать корневую папку или подпапку | ADMIN | `server/src/modules/categories/categories.controller.ts` |
| `PATCH /api/categories/order` | Порядок папок одного уровня: полный список id, пишет `sortOrder` | ADMIN | `server/src/modules/categories/categories.controller.ts` |
| `PATCH /api/categories/:id` | Переименовать папку, сохраняя родителя | ADMIN | `server/src/modules/categories/categories.controller.ts` |
| `DELETE /api/categories/:id` | Удалить только пустую папку | ADMIN | `server/src/modules/categories/categories.controller.ts` |
| `GET /api/products/variants` | Серверный поиск, поддерево категории, страницы 10/20/50; в строке все поля товара, включая закупку | ADMIN | `server/src/modules/products/catalog.controller.ts` |
| `PATCH /api/products/category` | Перенести товары со всеми модификациями в папку | ADMIN | `server/src/modules/products/catalog.controller.ts` |
| `POST /api/products/moysklad/preview` | Разбор выгрузки МойСклада: закупка, поставщик, сроки предзаказа по складам; без записи | ADMIN | `server/src/modules/products/moysklad.controller.ts` |
| `POST /api/products/moysklad/commit` | Запись закупки, поставщика и сроков предзаказа в найденные артикулы; новых товаров не заводит; история по каждому товару | ADMIN | `server/src/modules/products/moysklad.controller.ts` |
| `POST /api/products/moysklad/stock/preview` | Разбор отчёта «Остатки» для склада из `?warehouseId=`: остаток, резерв, ожидание, себестоимость, дни; список на обнуление; без записи | ADMIN | `server/src/modules/products/moysklad.controller.ts` |
| `POST /api/products/moysklad/stock/commit` | Запись остатков в выбранный склад, себестоимости в товар, обнуление того, чего нет в отчёте; история по каждому товару | ADMIN | `server/src/modules/products/moysklad.controller.ts` |
| `GET /api/stats/orders` | Сводка по заказам за период в разрезе точек: заказы, возвраты, выручка | ADMIN | `server/src/modules/stats/stats.controller.ts` |
| `POST /api/imports/offline-orders/preview` | Разбор листа книги Excel, без записи; без `?sheet=` — только список листов | ADMIN | `server/src/modules/imports/imports.controller.ts` |
| `POST /api/imports/offline-orders/commit` | Запись разобранных строк в заказы офлайн-точки | ADMIN | `server/src/modules/imports/imports.controller.ts` |
| `GET /api/suppliers` | Справочник поставщиков целиком, без пагинации | ADMIN | `server/src/modules/suppliers/suppliers.controller.ts` |
| `POST /api/suppliers/import/preview` | Разбор выгрузки контрагентов МойСклада: только группа «поставщики», без записи | ADMIN | `server/src/modules/suppliers/suppliers.controller.ts` |
| `POST /api/suppliers/import/commit` | Запись поставщиков: upsert по `externalId`, заполненное не перезаписывает | ADMIN | `server/src/modules/suppliers/suppliers.controller.ts` |
| `PATCH /api/suppliers/:id` | Правка карточки руками, прежде всего `telegramId`; удаления нет, только закрытие | ADMIN | `server/src/modules/suppliers/suppliers.controller.ts` |
| `GET /api/dictionaries` | Пополняемые списки: все четыре разом либо один по `?kind=` | любой вошедший | `server/src/modules/dictionaries/dictionaries.controller.ts` |
| `POST /api/dictionaries` | Добавить значение в список | ADMIN, MANAGER | `server/src/modules/dictionaries/dictionaries.controller.ts` |
| `PATCH /api/dictionaries/:id` | Переименовать или закрыть значение; удаления нет | ADMIN, MANAGER | `server/src/modules/dictionaries/dictionaries.controller.ts` |
| `GET /api/sales-points` | Справочник точек продаж: площадки и офлайн-точки | любой вошедший | `server/src/modules/sales-points/sales-points.controller.ts` |
| `POST /api/sales-points` | Создать офлайн-точку; код и тип ставит сервер | ADMIN | `server/src/modules/sales-points/sales-points.controller.ts` |
| `PATCH /api/sales-points/:id` | Переименовать, закрыть или открыть точку; удаления нет | ADMIN | `server/src/modules/sales-points/sales-points.controller.ts` |
| `GET /api/orders` | Страница заказов из нашей базы: поиск по номеру, период, точки продаж и продавцы | ADMIN | `server/src/modules/orders/orders.controller.ts` |
| `GET /api/orders/:id/comments` | Лента комментариев заказа, старые сверху | ADMIN | `server/src/modules/orders/orders.controller.ts` |
| `POST /api/orders/:id/comments` | Новый комментарий; автор из сессии, правок и удалений нет | ADMIN | `server/src/modules/orders/orders.controller.ts` |
| `GET /api/orders/kaspi` | Страница заказов Kaspi, разобранная в нашу модель; без записи в БД | ADMIN | `server/src/modules/orders/orders.controller.ts` |
| `POST /api/orders/sync` | Шаг синхронизации заказов: чанки по 3 дня, курсор, запись в БД | ADMIN | `server/src/modules/orders/orders.controller.ts` |

Подробные контракты — в [docs/api-reference.md](docs/api-reference.md).

### 1.2. Методы сервисов

| Модуль | Метод | Что делает | Файл |
|---|---|---|---|
| health | `getHealthStatus()` | Статус, окружение, аптайм, доступность базы | `server/src/modules/health/health.service.ts` |
| auth | `authenticate(login, password)` | Проверка пары; единая ошибка 401 на все случаи | `server/src/modules/auth/auth.service.ts` |
| auth | `hashPassword(password)` | Хеш argon2id | `server/src/modules/auth/auth.service.ts` |
| auth | `toAuthUser(user)` | DTO наружу без `passwordHash` | `server/src/modules/auth/auth.service.ts` |
| auth | `createSession(userId, ua, ip)` | Создание сессии на 7 дней | `server/src/modules/auth/auth.service.ts` |
| auth | `findActiveSession(id)` | Действующая сессия + пользователь, с проверкой срока и `isActive` | `server/src/modules/auth/auth.service.ts` |
| auth | `destroySession(id)`, `destroyUserSessions(userId)` | Гашение сессий | `server/src/modules/auth/auth.service.ts` |
| audit | `logAction(input)` | Запись в журнал действий; после операции, сбой не роняет операцию | `server/src/lib/audit.ts` |
| history | `recordHistory(tx, meta, entries)` | История изменений: в транзакции изменения, запись на сущность, пустые не пишет | `server/src/lib/history.ts` |
| history | `diffFields(entityType, before, after)`, `historyValue(value)` | Список изменившихся полей «было → стало»; значение строкой, Decimal с двумя знаками | `server/src/lib/history.ts` |
| users | `listUsers()` | Сотрудники, свежие сверху | `server/src/modules/users/users.service.ts` |
| users | `createUser(input, createdById)` | Создание; дубль логина → 409 | `server/src/modules/users/users.service.ts` |
| users | `toUserListItem(user)` | DTO наружу без `passwordHash` | `server/src/modules/users/users.service.ts` |
| audit | `listAuditLog(input)` | Страница журнала по 50 записей, фильтры по сущности и типу; `changes` и `context` из Json с проверкой формы | `server/src/modules/audit/audit.service.ts` |
| kaspi-catalog | `parseKaspiCatalog(xml, status)` | Разбор выгрузки Kaspi в список товаров; явные типы массивов складов и цен | `server/src/modules/kaspi-catalog/kaspi-catalog.parser.ts` |
| kaspi-catalog | `buildCatalogPreview(input)` | Сводка по двум файлам, поиск дублей артикулов | `server/src/modules/kaspi-catalog/kaspi-catalog.service.ts` |
| kaspi-catalog | `fetchCabinetCatalog(input)` | Обход всех страниц кабинета, частичный результат при обрыве | `server/src/modules/kaspi-catalog/kaspi-cabinet.service.ts` |
| kaspi-catalog | `fetchOffersPage(params)` | Одна страница JSON кабинета, проверка формата ответа | `server/src/modules/kaspi-catalog/kaspi-cabinet.client.ts` |
| kaspi-catalog | `toCabinetOffer(raw)` | Сырой товар кабинета в наш DTO, спорное помечает проблемой | `server/src/modules/kaspi-catalog/kaspi-cabinet.mapper.ts` |
| kaspi-catalog | `readAvailabilities(raw)` | Наличие товара по складам: `storeId`, код, остаток, предзаказ | `server/src/modules/kaspi-catalog/kaspi-cabinet.mapper.ts` |
| kaspi-catalog | `collectCabinetWarehouses(offers)` | Сводка складов за обход из `availabilities`; `cityId` кабинет не отдаёт | `server/src/modules/kaspi-catalog/kaspi-cabinet.warehouses.ts` |
| kaspi-catalog | `buildSample(raw)` | Три первых товара сырыми и разобранными — сверка маппинга в браузере | `server/src/modules/kaspi-catalog/kaspi-cabinet.service.ts` |
| kaspi-catalog | `rememberCookie()`, `getStoredCookie()`, `forgetCookie()` | Кука кабинета в памяти процесса, не на диске | `server/src/modules/kaspi-catalog/kaspi-cabinet.session.ts` |
| warehouses | `listWarehouses()` | Справочник складов по коду | `server/src/modules/warehouses/warehouses.service.ts` |
| warehouses | `saveKaspiWarehouses(input)` | Импорт складов: upsert по `code`, не трогает `name` и заполненный город | `server/src/modules/warehouses/warehouses.service.ts` |
| warehouses | `toWarehouseDto(warehouse)` | DTO наружу | `server/src/modules/warehouses/warehouses.service.ts` |
| kaspi-catalog | `readModelName(familyId, masterTitle, brand)` | Название модели («Эмбер») из двух источников: кандидаты из скобок `familyId` × хвост `masterTitle` после бренда. Не вышло — null с причиной | `server/src/modules/kaspi-catalog/kaspi-model-name.ts` |
| — | `rename-products` | Переименование сохранённых товаров правилом `readModelName()`. Без `--apply` только показывает; правки руками не затирает без `--force`; `--diagnose` добавляет разбор источников. Запуск `npm run rename:products --workspace=server` | `server/src/scripts/rename-products.ts` |
| products | `listKnownSkus()` | Артикулы, уже лежащие в базе | `server/src/modules/products/products.service.ts` |
| products | `importKaspiProducts(input, authorId)` | Импорт товаров кабинета: только новые, отчёт по пропущенным и сбойным | `server/src/modules/products/products.service.ts` |
| orders | `fetchKaspiOrders(params)`, `fetchKaspiOrdersRaw(params)` | Страница заказов Kaspi Shop API: со списком и `meta` либо тело целиком | `server/src/modules/orders/kaspi-orders.client.ts` |
| orders | `toOrderDraft(raw)` | Сырой заказ Kaspi в нашу модель; спорное помечает проблемой, поля кабинета оставляет пустыми | `server/src/modules/orders/kaspi-orders.mapper.ts` |
| orders | `syncKaspiOrders(input)` | Шаг синхронизации: отрезки по 3 дня от свежих к старым, upsert по номеру, поля кабинета не затирает | `server/src/modules/orders/orders.service.ts` |
| orders | `listOrders(input)` | Страница заказов из базы: поиск, период, фильтры по точке и продавцу, узкий DTO без персональных данных сверх нужного | `server/src/modules/orders/orders.service.ts` |
| orders | `listOrderComments(orderId)`, `addOrderComment(orderId, text, author)` | Лента комментариев; автор из сессии, роль снимком, правок и удалений нет | `server/src/modules/orders/order-comments.service.ts` |
| stats | `getOrderStats(input)` | Сводка за период: две группировки, привязанные заказы вне сумм | `server/src/modules/stats/stats.service.ts` |
| imports | `readWorkbook(file)`, `listSheets(wb)`, `parseSheet(wb, name, dict)` | Разбор книги Excel: колонки по заголовкам, спорное — в `problems`, а не в заказ | `server/src/modules/imports/offline-orders.parser.ts` |
| imports | `previewOfflineImport(file, input)` | Предпросмотр листа: строки, пропуски, значения не из справочников | `server/src/modules/imports/imports.service.ts` |
| imports | `commitOfflineImport(input, author)` | Запись строк в заказы точки: номера `OFF-1-000001`, всё одной транзакцией | `server/src/modules/imports/imports.service.ts` |
| — | `readWorkbook(file)`, `listSheets(wb)`, `requireSheet(wb, name)`, `readText(cell)`, `readNumber(cell)` | Чтение книги `.xlsx` и её ячеек, общее для всех импортов; старый `.xls` узнаётся по подписи — ошибка с подсказкой пересохранить | `server/src/lib/excel.ts` |
| suppliers | `parseContractors(wb, sheet)` | Разбор выгрузки контрагентов: колонки по заголовкам, отбор по группе «поставщики», заглушка телефона отбрасывается | `server/src/modules/suppliers/suppliers.parser.ts` |
| suppliers | `listSuppliers()` | Справочник целиком, вместе с закрытыми | `server/src/modules/suppliers/suppliers.service.ts` |
| suppliers | `previewSupplierImport(file, input)` | Предпросмотр: строки группы, счётчики отброшенных, сверка с базой по `externalId` | `server/src/modules/suppliers/suppliers.service.ts` |
| suppliers | `commitSupplierImport(input, meta)` | Запись: новые заводит, существующим дозаполняет только пустые поля, `telegramId` не трогает; история | `server/src/modules/suppliers/suppliers.service.ts` |
| suppliers | `updateSupplier(id, input, meta)` | Правка карточки руками в транзакции с историей; `externalId` сменить нельзя | `server/src/modules/suppliers/suppliers.service.ts` |
| dictionaries | `listDictionaries(input)` | Значения списков: все либо один вид, с счётчиком заказов | `server/src/modules/dictionaries/dictionaries.service.ts` |
| dictionaries | `createDictionaryItem(input)`, `updateDictionaryItem(id, input)` | Добавление, переименование и закрытие значения; вид не меняется | `server/src/modules/dictionaries/dictionaries.service.ts` |
| dictionaries | `loadDictionaryIndex()`, `normalizeName(name)` | Индекс «вид → название → id» для импорта; приведение названия к сравнимому виду | `server/src/modules/dictionaries/dictionaries.service.ts` |
| sales-points | `listSalesPoints()` | Справочник целиком, вместе с закрытыми и счётчиком заказов | `server/src/modules/sales-points/sales-points.service.ts` |
| sales-points | `createOfflineSalesPoint(input)` | Новая офлайн-точка: код `OFF-N` генерится под Serializable | `server/src/modules/sales-points/sales-points.service.ts` |
| sales-points | `updateSalesPoint(id, input)` | Переименование и закрытие; код и тип не меняются | `server/src/modules/sales-points/sales-points.service.ts` |
| sales-points | `getKaspiSalesPointId()` | Точка Kaspi по коду — привязка заказов при синхронизации | `server/src/modules/sales-points/sales-points.service.ts` |
| orders | `readDeliveryType(input)`, `readOrderStatus(input, type)` | Тип доставки и стадия заказа из полей Kaspi (алгоритм раздела 5.3) | `server/src/modules/orders/kaspi-order-status.ts` |
| orders | `isKnownStatus(value)`, `isKnownState(value)`, `KNOWN_KASPI_STATUSES`, `KNOWN_KASPI_STATES` | Список известных значений Kaspi; незнакомое помечается проблемой, а не падает в «Новый» | `server/src/modules/orders/kaspi-order-status.ts` |
| db | `prisma` | Единственный экземпляр Prisma Client | `server/src/db/client.ts` |
| db | `isDatabaseReachable()` | Проверка соединения с базой | `server/src/db/client.ts` |
| db | `disconnectDatabase()` | Закрытие пула при остановке | `server/src/db/client.ts` |
| categories | `getCategoryTree()` | Дерево папок одним запросом, «Все товары» отдельно | `server/src/modules/categories/categories.service.ts` |
| categories | `createCategory(input)` | Создать корневую папку/подпапку (два уровня), проверить дубли, заполнить path | `server/src/modules/categories/categories.service.ts` |
| categories | `renameCategory(id, name)` | Переименовать с проверкой дублей; before/after для аудита | `server/src/modules/categories/categories.service.ts` |
| categories | `reorderCategories(input)` | Порядок уровня: сверяет полный состав, пишет `sortOrder` только изменившимся | `server/src/modules/categories/categories.service.ts` |
| categories | `deleteCategory(id)` | Заблокировать запись и удалить только без товаров/подпапок | `server/src/modules/categories/categories.service.ts` |
| products | `listCatalog(input)` | Страница артикулов с поиском и фильтром по поддереву | `server/src/modules/products/catalog.service.ts` |
| products | `moveProductsToCategory(input, meta)` | Атомарный перенос Product, старые категории для аудита, история папки по каждому товару | `server/src/modules/products/catalog.service.ts` |
| products | `toCatalogRow(row, now)` | Полный DTO строки каталога: все поля артикула, точные цены, галерея, закупка и себестоимость (только дашборд); по складу — доступно и дни на складе, посчитанные при выдаче | `server/src/modules/products/catalog.mapper.ts` |
| products | `parseMoyskladSheet(wb, sheet, warehouses)` | Разбор выгрузки МойСклада: колонки по заголовкам, отбор по типу строки, цена-строка с запятой, сроки предзаказа по складам | `server/src/modules/products/moysklad.parser.ts` |
| products | `previewMoyskladImport(file, input)` | Предпросмотр: пометка задвоенных кодов, сверка с каталогом и поставщиками, счётчики | `server/src/modules/products/moysklad.service.ts` |
| products | `commitMoyskladImport(input, meta)` | Запись пачками по 100: закупка с валютой, поставщик, `preOrderDays` по складам, история. Пустое в файле не затирает | `server/src/modules/products/moysklad.service.ts` |
| products | `markDuplicateCodes(rows)`, `loadSkuIndex()` | Общее двух импортов МойСклада: пометка задвоенных кодов, артикулы каталога по нормализованному коду | `server/src/modules/products/moysklad.common.ts` |
| products | `parseStockReport(wb, sheet)` | Разбор отчёта «Остатки»: заголовок под шапкой, папки и «Итого» пропускаются, пусто → 0, момент отчёта по Астане | `server/src/modules/products/moysklad-stock.parser.ts` |
| products | `previewStockImport(file, input)` | Предпросмотр по складу: сверка с каталогом, счётчики, список на обнуление | `server/src/modules/products/moysklad-stock.service.ts` |
| products | `commitStockImport(input, meta)` | Запись пачками по 100: остаток, резерв, ожидание, `receivedAt`, себестоимость; обнуление по списку предпросмотра; история | `server/src/modules/products/moysklad-stock.service.ts` |

### 1.3. Модели БД

| Модель | Назначение | Связи |
|---|---|---|
| `User` | Сотрудник: вход в дашборд по логину, роль, должность | `createdBy` / `createdUsers` — self-relation «кто завёл» |
| `Customer` | Клиент магазина: свой вход, телефон обязателен, email нет | — |
| `Session` | Сессия сотрудника; в куке только id, состояние в таблице | `user` → `User`, `onDelete: Cascade` |
| `AuditLog` | Журнал действий и история изменений полей (`source`, `changes`, `context`), только вставка и чтение | связей нет: логин и роль снимком |
| `Warehouse` | Склад Kaspi: код `PP3`, `kaspiStoreId`, КАТО, наше название, снимок товаров и остатка | `stocks` → `VariantStock` |
| `Category` | Папка каталога, наше дерево с `path` | self-relation `parent` / `children`, `products` |
| `Product` | Карточка модели: название, категория, бренд, `kaspiFamilyId` | `category`, `variants` |
| `Variant` | Артикул: поля кабинета, статус продажи, флаги доставки, закупка с валютой, себестоимость в тенге, поставщик, ткань | `product`, `listings`, `stocks`, `fabric`, `fabricShade`, `supplier` |
| `Listing` | Размещение на канале: цена, статус, ID площадки | `variant`; `@@unique([variantId, channel])` |
| `VariantStock` | Артикул на складе: остаток (бывает отрицательным), резерв, ожидание, средняя дата поступления, момент снимка, срок предзаказа | `variant`, `warehouse` |
| `Fabric` | Ткань обивки: наш справочник, Kaspi её не знает | `shades`, `variants` |
| `FabricShade` | Оттенок ткани, принадлежит своей ткани | `fabric`, `variants` |
| `SalesPoint` | Точка продаж: площадки (`KASPI`, `OZON`, `SITE`) и офлайн-точки в одном справочнике. Удаления нет, только закрытие | `orders` → `Order` |
| `DictionaryItem` | Пополняемые списки офлайн-точки: откуда клиент, статус доставки, откуда поехал товар, способ оплаты. Различаются полем `kind` | четыре связи с `Order` |
| `OrderComment` | Комментарий к заказу: автор связью, роль снимком. Только добавление | `order`, `author` → `User` |
| `Order` | Заказ: точка продаж, продавец, два статуса площадки + наш вычисленный, даты, деньги, покупатель, адрес, склад. Поля кабинета заведены пустыми | `salesPoint`, `seller` → `User`, `warehouse` → `Warehouse`, `entries`, `markers`, `steps`, `comments` |
| `OrderEntry` | Позиция заказа: артикул, названия обоих источников, количество, цены | `order`, `variant` (необязательная) |
| `OrderMarker` | Событие истории заказа: кто и когда двигал. Только из кабинета | `order`; `@@unique([orderId, marker, at])` |
| `OrderStep` | Этап заказа со сроками и дедлайном. Только из кабинета | `order`; `@@unique([orderId, step])` |
| `Supplier` | Поставщик: от кого приехал товар. `externalId` — UUID МойСклада, `@unique`, ключ повторного импорта. `telegramId` только руками. Удаления нет, только закрытие | `variants` → `Variant`, `onDelete: Restrict` |
| `Currency` (enum) | Валюта суммы: KZT, RUB. Пересчёта к одной валюте нет — курс на дату закупки неизвестен | — |
| `UserRole` (enum) | Роли сотрудников: ADMIN, MANAGER, SELLER | — |
| `SalesChannel` (enum) | Каналы продаж: SITE, KASPI, OZON | — |
| `ListingStatus` (enum) | Статус размещения: ON_SALE, OFF_SALE | — |
| `ChangeSource` (enum) | Источник записи истории: KASPI_SYNC, MANUAL, IMPORT | — |
| `SalesPointType` (enum) | Вид точки продаж: KASPI, OZON, SITE, OFFLINE. Не путать с `SalesChannel` | — |
| `DictionaryKind` (enum) | Вид пополняемого списка: CUSTOMER_SOURCE, DELIVERY_STATUS, SHIPMENT_ORIGIN, PAYMENT_METHOD | — |
| `OrderDeliveryType` (enum) | Тип доставки: KASPI, PICKUP, OWN | — |
| `OrderStatus` (enum) | 13 стадий заказа, от NEW до RETURNED | — |

Подробности — в [docs/data-model.md](docs/data-model.md).

### 1.4. Страницы и маршруты

| URL | Раздел | Файл |
|---|---|---|
| `/` | Магазин — главная (заглушка) | `front/src/app/(shop)/page.tsx` |
| `/dashboard` | Админка — сводка (в меню «Статистика»); проверяет связь с API, кнопка «Создать офлайн точку продажи» с модалкой | `front/src/app/dashboard/(main)/page.tsx` |
| `/dashboard/login` | Вход сотрудника в админку | `front/src/app/dashboard/(auth)/login/page.tsx` |
| `/dashboard/accounts` | Аккаунты и История: таблица сотрудников, создание, журнал действий | `front/src/app/dashboard/(main)/accounts/page.tsx` |
| `/dashboard/products` | Каталог: два уровня папок с поиском и порядком, серверный поиск, таблица с выделением и переносом в папку | `front/src/app/dashboard/(main)/products/page.tsx` |
| `/dashboard/orders` | Заказы: две кнопки синхронизации с Kaspi, поиск по номеру, фильтр по точке продаж, выбор периода, таблица. При загрузке печатает сырьё Kaspi в консоль (отладка, убрать после сверки статусов) | `front/src/app/dashboard/(main)/orders/page.tsx` |
| `/dashboard/imports` | Импорты: блоки «Excel продаж офлайн-точки», «Поставщики из МойСклада», «Товары из МойСклада», «Остатки из МойСклада» (склад, файл, предпросмотр, список на обнуление, запись). Только ADMIN | `front/src/app/dashboard/(main)/imports/page.tsx` |
| `/dashboard/kaspi-sync` | Синхронизация с Kaspi: загрузка выгрузок, предпросмотр каталога | `front/src/app/dashboard/(main)/kaspi-sync/page.tsx` |

**Каталог с деревом папок:** `/dashboard/products` подключён к API; дерево, создание папок, поиск и пагинация готовы. Строки товаров через children добавляет пользователь. Ответ API выводится в консоль браузера. См. [docs/app-structure.md](docs/app-structure.md).

Структура маршрутов и layout — в [docs/app-structure.md](docs/app-structure.md).
Целевой состав dashboard — 8 табов аналитики, см. [docs/analytics-spec.md](docs/analytics-spec.md).

### 1.5. Ключевые компоненты

| Компонент | Где используется | Файл |
|---|---|---|
| `RootLayout` | Корень: шрифты, провайдеры, `lang="ru"` | `front/src/app/layout.tsx` |
| `Providers` | Redux-провайдер, стор на клиента | `front/src/app/providers.tsx` |
| `ShopLayout` | Обвязка магазина, класс `theme-shop` | `front/src/app/(shop)/layout.tsx` |
| `DashboardRootLayout` | Общая обвязка админки, класс `theme-dashboard` | `front/src/app/dashboard/layout.tsx` |
| `DashboardMainLayout` | Сайдбар и рабочая область разделов админки | `front/src/app/dashboard/(main)/layout.tsx` |
| `DashboardAuthLayout` | Форма входа по центру, без сайдбара | `front/src/app/dashboard/(auth)/layout.tsx` |
| `PriceTag` | Ценник товара; образец SCSS-модуля с токенами темы | `front/src/components/price-tag/` |
| `TreeFolder` | Два уровня папок: поиск, выбор, раскрытие; действия папки — в меню `Dropdown` (подпапка, переименовать, выше/ниже, удалить) | `front/src/components/tree-folder/page.tsx`, `front/src/components/tree-folder/style.module.scss` |
| `Tables` | Таблица с children-строками, head и серверной пагинацией 10/20/50 | `front/src/components/tables/page.tsx`, `front/src/components/tables/style.module.scss` |
| `ProductsLayout` | Защита раздела товаров ролью ADMIN | `front/src/app/dashboard/(main)/products/layout.tsx` |
| `Loader` | Сегментное кольцо #f23428; size задаёт диаметр, hideLabel скрывает текст; label по умолчанию «Загрузка ...», подсветка букв каждые 160 мс | `front/src/components/loader/tree-list.tsx`, `front/src/components/loader/style.module.scss` |
| `Dropdown` | Два режима через проп `mode`: `menu` — меню на три точки (пункты в `items`), `select` — выбор значения (варианты в `options`, `value`/`onChange`, галочка у выбранного, пометка «закрыто»). Проп `searchable` включает поиск по списку. Клик вне, Escape, стрелки; из поля поиска стрелки уводят в список. Список в портале с `position: fixed`, закрывается при прокрутке | `front/src/components/dropdown/index.tsx`, `front/src/components/dropdown/style.module.scss` |
| `Checkbox` | Чекбокс поверх нативного input, с частичным состоянием (`indeterminate`) | `front/src/components/checkbox/` |
| `Modal` | Модальное окно на нативном `<dialog>`: шапка с заголовком и крестиком, тело из children, необязательный подвал. Закрытие крестиком, Escape и кликом по подложке; выделение текста мимо окна не закрывает | `front/src/components/modal/` |
| `DateRangePicker` | Календарь выбора периода: месяц листается отдельно от выбора, подсветка диапазона по курсору, «Сбросить» и «Применить» | `front/src/components/date-range-picker/` |
| `Input` | Поле ввода: подпись, ошибка, нативные пропсы | `front/src/components/input/` |
| `Button` | Кнопка: варианты через классы, нативные пропсы | `front/src/components/button/` |
| `AuthGuard` | Пускает в разделы админки только вошедших | `front/src/features/auth/auth-guard.tsx` |
| `RoleGuard` | Ограничение раздела по ролям с редиректом | `front/src/features/auth/role-guard.tsx` |
| `UsersTable` | Таблица сотрудников | `front/src/app/dashboard/(main)/accounts/_components/users-table.tsx` |
| `AuditTable` | Таблица журнала действий | `front/src/app/dashboard/(main)/accounts/_components/audit-table.tsx` |
| `CreateUserDialog` | Модалка создания сотрудника на нативном `<dialog>` | `front/src/app/dashboard/(main)/accounts/_components/create-user-dialog.tsx` |
| `CreateSalesPointDialog` | Модалка новой офлайн-точки на общем `Modal`: одно поле «Название», код и тип ставит сервер | `front/src/app/dashboard/(main)/_components/create-sales-point-dialog.tsx` |
| `StatsBlock`, `StatsCards` | Сводка на «Статистике»: период (текущий/прошлый месяц, календарь), итог и блок плашек на каждую точку продаж | `front/src/app/dashboard/(main)/_components/stats-block.tsx` |
| `OfflineOrdersImport` | Блок импорта продаж: выбор точки и листа, счётчики разбора, значения не из справочников, кнопка записи | `front/src/app/dashboard/(main)/imports/_components/offline-orders-import.tsx` |
| `ImportPreviewTable` | Таблица разобранных строк файла: непригодные подсвечены, замечания отдельной строкой под записью | `front/src/app/dashboard/(main)/imports/_components/import-preview-table.tsx` |
| `MoyskladProductsImport` | Блок импорта товаров из МойСклада: файл, счётчики (в файле / не товары / готовы / нет в каталоге / задвоенный код), сводка ненайденных поставщиков, таблица, запись | `front/src/app/dashboard/(main)/imports/_components/moysklad-products-import.tsx` |
| `MoyskladPreviewTable` | Таблица разобранных товаров: код, закупка с валютой, поставщик, предзаказ по складам, найден ли артикул; замечания строкой под записью | `front/src/app/dashboard/(main)/imports/_components/moysklad-preview-table.tsx` |
| `MoyskladStockImport` | Блок импорта остатков: выбор склада (`Dropdown` select), файл, счётчики, момент отчёта, список на обнуление, склад в подписи кнопки записи | `front/src/app/dashboard/(main)/imports/_components/moysklad-stock-import.tsx` |
| `MoyskladStockPreviewTable`, `StockZeroTable` | Таблица строк отчёта остатков (пропущенные подсвечены, замечания строкой) и таблица того, что обнулится | `front/src/app/dashboard/(main)/imports/_components/moysklad-stock-preview-table.tsx` |
| `SuppliersImport` | Блок импорта поставщиков: файл, счётчики (в файле / не поставщики / новых / уже в базе), таблица, запись. Лист выбирается только когда их в книге несколько | `front/src/app/dashboard/(main)/imports/_components/suppliers-import.tsx` |
| `SupplierPreviewTable` | Таблица разобранных контрагентов: непригодные подсвечены, расхождения с нашими данными и замечания — строками под записью | `front/src/app/dashboard/(main)/imports/_components/supplier-preview-table.tsx` |
| `ImportsLayout` | Защита раздела импортов ролью ADMIN | `front/src/app/dashboard/(main)/imports/layout.tsx` |
| `CatalogSummary` | Счётчики разбора выгрузки над таблицей товаров | `front/src/app/dashboard/(main)/kaspi-sync/_components/catalog-summary.tsx` |
| `WarehousesPanel` | Таблица складов и сохранение их в справочник; общая для выгрузки и кабинета | `front/src/app/dashboard/(main)/kaspi-sync/_components/warehouses-panel.tsx` |
| `ProductsImportPanel` | Счётчик новых товаров и сохранение их в каталог | `front/src/app/dashboard/(main)/kaspi-sync/_components/products-import-panel.tsx` |
| `CatalogTable` | Таблица разобранных товаров Kaspi | `front/src/app/dashboard/(main)/kaspi-sync/_components/catalog-table.tsx` |
| `CatalogPagination` | Панель пагинации под таблицей: размер страницы, номера, диапазон | `front/src/app/dashboard/(main)/kaspi-sync/_components/catalog-pagination.tsx` |
| `CabinetFetch` | Кука, запуск загрузки из кабинета, счётчики, склады, фильтр и таблица | `front/src/app/dashboard/(main)/kaspi-sync/_components/cabinet-fetch.tsx` |
| `CabinetTable` | Таблица товаров из кабинета: картинка, штрихкод, цены со скидкой, размер | `front/src/app/dashboard/(main)/kaspi-sync/_components/cabinet-table.tsx` |
| `CatalogRow`, `CatalogTableHead`, `CATALOG_COLUMN_COUNT` | Строка и шапка таблицы каталога: галка выделения, кружок статуса, квадратное фото, два названия, цена Kaspi в две строки со скидкой, закупка с валютой, себестоимость в ₸, поставщик, склады чипами «код · название», затем колонки Остаток, Резерв, Ожидание, Доступно, Предзаказ, Дней на складе — строкой на склад в том же порядке, закреплённое меню действий. Стили — `catalog-row.module.scss` | `front/src/app/dashboard/(main)/products/_components/catalog-row.tsx` |
| `MoveToCategoryDialog` | Модалка переноса выбранных товаров: дерево папок с поиском, затем подтверждение | `front/src/app/dashboard/(main)/products/_components/move-to-category-dialog.tsx` |
| `OrderDictionaryFilters` | Четыре выпадашки под кнопками синхронизации: статус доставки, оплата, откуда товар, откуда клиент. Общий `Dropdown` в режиме `select` с поиском; закрытые значения остаются в списке с пометкой | `front/src/app/dashboard/(main)/orders/_components/order-dictionary-filters.tsx` |
| `OrderRow`, `OrderTableHead`, `orderColumnCount(showOffline)` | Строка и шапка таблицы заказов. Общие колонки: дата, статус, номер, покупатель, город, точка продаж, кто создал, доставка, сумма, планируемая доставка. При `showOffline` добавляются восемь офлайновых: номер продавца, откуда товар, статус доставки, откуда клиент, оплата, скидка, оплачено, остаток. Стили — `order-row.module.scss` | `front/src/app/dashboard/(main)/orders/_components/order-row.tsx` |

### 1.6. Общие функции, хуки, константы

| Имя | Назначение | Файл |
|---|---|---|
| `USER_ROLES`, `UserRole` | Роли сотрудников: ADMIN, MANAGER, SELLER | `shared/src/constants/roles.ts` |
| `USER_ROLE_LABELS` | Подписи ролей для интерфейса | `shared/src/constants/roles.ts` |
| `AUDIT_ACTIONS`, `AUDIT_ACTION_LABELS` | Действия для журнала и их подписи | `shared/src/constants/audit-actions.ts` |
| `HISTORY_ENTITY_TYPES`, `HISTORY_FIELD_LABELS`, `HistoryField<E>`, `historyFieldLabel()` | Словарь истории: сущности с историей и подписи их полей. В базе ключ поля, подпись — отсюда при показе | `shared/src/constants/history-fields.ts` |
| `HISTORY_SOURCES`, `HistorySource`, `HISTORY_SOURCE_LABELS` | Источник изменения: вручную, импорт, синхронизация Kaspi | `shared/src/constants/history-fields.ts` |
| `HistoryChange`, `HistoryContext` | Изменённое поле `{ field, from, to }` и обстоятельства: склад, документ, лист, пояснение | `shared/src/types/history.ts` |
| `AuditLogEntry`, `AuditLogQuery` | Запись журнала/истории наружу и фильтры `GET /api/audit` | `shared/src/types/audit.ts` |
| `HistoryAuthor`, `HistoryEntry`, `HistoryMeta` | Контракт `recordHistory()`: автор, источник, записи | `server/src/lib/history.ts` |
| `auditQuerySchema` | Проверка фильтров журнала: сущность только парой, тип из `AUDIT_ACTIONS` | `server/src/modules/audit/audit.schemas.ts` |
| `LOGIN_PATTERN`, `PASSWORD_PATTERN`, `normalizeLogin()` | Правила логина и пароля, общие для сервера и формы | `shared/src/constants/credentials.ts` |
| `LoginRequest`, `AuthUser`, `AuthResponse` | Контракты входа | `shared/src/types/auth.ts` |
| `requireAuth`, `requireRole(...roles)` | Проверка сессии и ролей | `server/src/middlewares/require-auth.ts` |
| `SESSION_COOKIE_NAME`, `sessionCookieOptions` | Настройки куки сессии | `server/src/config/session.ts` |
| `SALES_POINT_TYPES`, `SALES_POINT_TYPE_LABELS`, `isSystemSalesPointType()` | Виды точек продаж: KASPI, OZON, SITE, OFFLINE | `shared/src/constants/sales-points.ts` |
| `SYSTEM_SALES_POINT_CODES`, `OFFLINE_SALES_POINT_CODE_PREFIX`, `SALES_POINT_NAME_MAX_LENGTH`, `ORDER_COMMENT_MAX_LENGTH` | Коды системных точек, префикс `OFF` и лимиты названия и комментария | `shared/src/constants/sales-points.ts` |
| `SalesPointDto`, `SalesPointsResponse`, `CreateSalesPointRequest`, `UpdateSalesPointRequest` | Контракты справочника точек продаж | `shared/src/types/sales-points.ts` |
| `DICTIONARY_KINDS`, `DICTIONARY_KIND_LABELS`, `DICTIONARY_NAME_MAX_LENGTH`, `WRONG_ENTRY_DELIVERY_STATUS` | Виды пополняемых списков и пометка «Ошибочный ввод» | `shared/src/constants/dictionaries.ts` |
| `DictionaryItemDto`, `DictionariesResponse`, `CreateDictionaryItemRequest`, `UpdateDictionaryItemRequest` | Контракты пополняемых списков | `shared/src/types/dictionaries.ts` |
| `OfflineOrderDraft`, `OfflineImportPreview`, `ImportRowProblem`, `ImportUnknownValue` | Контракты разбора книги Excel: строка, предпросмотр, замечания | `shared/src/types/imports.ts` |
| `CommitOfflineImportRequest`, `CommitOfflineImportResponse` | Контракт записи импортированных строк | `shared/src/types/imports.ts` |
| `OrderSalesPointDto`, `OrderSellerDto`, `OrderCommentDto`, `OrderCommentsResponse`, `CreateOrderCommentRequest` | Точка, продавец и комментарии в контрактах заказа | `shared/src/types/orders.ts` |
| `useGetSalesPointsQuery`, `useCreateSalesPointMutation`, `useUpdateSalesPointMutation` | Справочник точек; тег `SalesPoint`, правка сбрасывает и `Order` | `front/src/features/sales-points/sales-points-api.ts` |
| `useGetDictionariesQuery`, `useAddDictionaryItemMutation`, `useUpdateDictionaryItemMutation` | Пополняемые списки; тег `Dictionary`, правка сбрасывает и `Order` | `front/src/features/dictionaries/dictionaries-api.ts` |
| `useGetOrderStatsQuery` | Сводка по заказам; тег `Order` — после синхронизации и импорта пересчитывается сама | `front/src/features/stats/stats-api.ts` |
| `useOrderStats()` | Период сводки: текущий/прошлый месяц или календарь, карточки по точкам | `front/src/features/stats/use-order-stats.ts` |
| `dayStart`, `dayEnd`, `toMoment`, `currentMonth`, `previousMonth` | Границы суток и готовые периоды в поясе пользователя; общие для реестра и сводки | `front/src/lib/day-range.ts` |
| `OrderStatsCard`, `OrderStatsQuery`, `OrderStatsResponse` | Контракт сводки по заказам | `shared/src/types/stats.ts` |
| `CURRENCIES`, `Currency`, `CURRENCY_LABELS`, `CURRENCY_NAMES` | Валюты сумм: KZT, RUB; символы и названия | `shared/src/constants/currencies.ts` |
| `MOYSKLAD_WAREHOUSE_COLUMNS`, `MOYSKLAD_IGNORED_WAREHOUSE_COLUMNS` | Раскладка «колонка выгрузки → код склада»: PP3, PP6, PP27, PP4; Алматы не используется | `shared/src/constants/moysklad.ts` |
| `MOYSKLAD_GOODS_TYPES`, `MOYSKLAD_CURRENCIES`, `MOYSKLAD_MAX_PREORDER_DAYS`, `MOYSKLAD_IMPORT_MAX_ROWS` | Типы строк, идущих в каталог, сопоставление валют и пределы импорта | `shared/src/constants/moysklad.ts` |
| `MoyskladProductDraft`, `MoyskladStockDraft`, `MoyskladImportPreview`, `CommitMoyskladImportRequest`, `CommitMoyskladImportResponse` | Контракты импорта товаров из МойСклада | `shared/src/types/moysklad.ts` |
| `StockReportRow`, `StockZeroCandidate`, `StockImportPreview`, `CommitStockImportRequest`, `CommitStockImportResponse` | Контракты импорта остатков из отчёта «Остатки» | `shared/src/types/moysklad.ts` |
| `MOYSKLAD_REPORT_UTC_OFFSET_HOURS`, `MOYSKLAD_MAX_STOCK_QUANTITY`, `MOYSKLAD_MAX_DAYS_ON_STOCK` | Пояс времени отчёта (Астана, +5) и пределы правдоподобного остатка и дней | `shared/src/constants/moysklad.ts` |
| `usePreviewMoyskladImportMutation`, `useCommitMoyskladImportMutation` | Разбор выгрузки МойСклада и запись; тег `Product` | `front/src/features/products/moysklad-api.ts` |
| `usePreviewStockImportMutation`, `useCommitStockImportMutation` | Разбор отчёта остатков по складу и запись; теги `Product`, `Audit` | `front/src/features/products/moysklad-api.ts` |
| `useMoyskladImport()` | Импорт товаров: файл, листы, разбор, счётчики, запись, сброс | `front/src/features/products/use-moysklad-import.ts` |
| `useMoyskladStockImport()` | Импорт остатков: склад, файл, листы, разбор (заново при смене склада), запись ровно того, что показано | `front/src/features/products/use-moysklad-stock-import.ts` |
| `SUPPLIER_IMPORT_GROUP`, `SUPPLIER_GROUP_SEPARATORS`, `SUPPLIER_IMPORT_MAX_ROWS` | Группа контрагентов, считаемая поставщиками, разделители вложенных групп и лимит строк записи | `shared/src/constants/suppliers.ts` |
| `SUPPLIER_NAME_MAX_LENGTH`, `SUPPLIER_ADDRESS_MAX_LENGTH`, `SUPPLIER_PHONE_MAX_LENGTH`, `SUPPLIER_TELEGRAM_ID_MAX_LENGTH` | Лимиты полей карточки поставщика | `shared/src/constants/suppliers.ts` |
| `SupplierDto`, `SuppliersResponse`, `UpdateSupplierRequest` | Контракты справочника поставщиков | `shared/src/types/suppliers.ts` |
| `SupplierDraft`, `SupplierDiff`, `SupplierImportPreview`, `CommitSupplierImportRequest`, `CommitSupplierImportResponse` | Контракты импорта поставщиков: строка, расхождение с нашими данными, предпросмотр, запись | `shared/src/types/suppliers.ts` |
| `useGetSuppliersQuery`, `usePreviewSupplierImportMutation`, `useCommitSupplierImportMutation`, `useUpdateSupplierMutation` | Справочник и импорт поставщиков; тег `Supplier` | `front/src/features/suppliers/suppliers-api.ts` |
| `useSupplierImport()` | Импорт поставщиков: файл, листы, разбор, счётчики, запись, сброс | `front/src/features/suppliers/use-supplier-import.ts` |
| `usePreviewOfflineImportMutation`, `useCommitOfflineImportMutation` | Разбор книги Excel и запись строк; файл уходит двоичным телом | `front/src/features/imports/imports-api.ts` |
| `useOfflineImport()` | Импорт продаж: файл, список листов, разбор, счётчики, запись, сброс | `front/src/features/imports/use-offline-import.ts` |
| `useCreateSalesPointForm(onCreated)` | Форма новой офлайн-точки: одно поле, защита от двойной отправки | `front/src/features/sales-points/use-create-sales-point-form.ts` |
| `useGetOrderCommentsQuery`, `useAddOrderCommentMutation` | Лента комментариев заказа; тег с id заказа | `front/src/features/orders/orders-api.ts` |
| `ORDER_STATUSES`, `ORDER_STATUS_LABELS`, `ORDER_STATUS_ORDER`, `ORDER_FINAL_STATUSES` | 13 стадий заказа, подписи как в кабинете, порядок для вкладок и список закрытых | `shared/src/constants/order-statuses.ts` |
| `ORDER_DELIVERY_TYPES`, `ORDER_DELIVERY_TYPE_LABELS` | Тип доставки: Kaspi Доставка, Самовывоз, Своя доставка | `shared/src/constants/order-statuses.ts` |
| `ApiErrorResponse`, `PaginatedResponse` | Общие формы ответов API | `shared/src/types/api.ts` |
| `env`, `corsOrigins`, `isProduction` | Проверенные переменные окружения | `server/src/config/env.ts` |
| `logger` | Логирование с уровнями | `server/src/lib/logger.ts` |
| `AppError` и наследники | Типизированные ошибки с HTTP-кодами | `server/src/lib/errors.ts` |
| `errorHandler`, `notFound`, `requestLog` | Мидлвары Express | `server/src/middlewares/` |
| `createApp()` | Сборка Express-приложения | `server/src/app.ts` |
| `makeStore()`, `RootState`, `AppDispatch` | Redux-стор, фабрика на клиента | `front/src/store/index.ts` |
| `useAppDispatch`, `useAppSelector`, `useAppStore` | Типизированные хуки Redux | `front/src/store/hooks.ts` |
| `baseApi` | Единая точка RTK Query, теги кэша | `front/src/shared/api/base-api.ts` |
| `useGetHealthQuery` | Образец эндпоинта RTK Query | `front/src/features/health/health-api.ts` |
| `useLoginMutation`, `useLogoutMutation`, `useGetMeQuery` | Эндпоинты входа; общий тег кэша `Auth` | `front/src/features/auth/auth-api.ts` |
| `useAuth()` | Текущий пользователь, признак загрузки и входа | `front/src/features/auth/use-auth.ts` |
| `useLogout()` | Выход и переход на форму входа | `front/src/features/auth/use-auth.ts` |
| `useLoginForm()` | Состояние формы входа, отправка, текст ошибки | `front/src/features/auth/use-login-form.ts` |
| `apiErrorMessage(error, fallback)` | Текст ошибки из ответа RTK Query | `front/src/shared/api/error-message.ts` |
| `apiFieldErrors(error)` | Ошибки по полям из `VALIDATION_ERROR` | `front/src/shared/api/error-message.ts` |
| `useGetUsersQuery`, `useCreateUserMutation` | Сотрудники; тег `User` обновляет таблицу после создания | `front/src/features/users/users-api.ts` |
| `useCreateUserForm(onSuccess)` | Состояние формы создания сотрудника | `front/src/features/users/use-create-user-form.ts` |
| `useGetAuditLogQuery` | Журнал действий | `front/src/features/audit/audit-api.ts` |
| `formatDateTime(iso)` | Дата и время в часовом поясе пользователя | `front/src/lib/format.ts` |
| `moneyToNumber(value)` | Цена из API (строка `"48230.00"`) в число для показа; пусто → null, не 0 | `front/src/lib/format.ts` |
| `formatMoney(value)` | Цена для показа: `114 990 ₸`, без тиын. Используют и `PriceTag`, и строка каталога | `front/src/lib/format.ts` |
| `usePagination(items, pageSize)` | Постраничный показ списка из памяти: срез страницы, номера с разрывами, диапазон | `front/src/lib/use-pagination.ts` |
| `PAGE_SIZE_OPTIONS`, `DEFAULT_PAGE_SIZE`, `PAGINATION_GAP` | Размеры страницы (10/20/30) и метка разрыва в ряду номеров | `front/src/lib/use-pagination.ts` |
| `SALES_CHANNELS`, `LISTING_STATUSES` и подписи | Каналы продаж (SITE, KASPI, OZON) и статус размещения | `shared/src/constants/sales-channels.ts` |
| `ImportKaspiProductsRequest`, `ImportKaspiProductsResponse`, `KnownSkusResponse` | Контракты сохранения товаров в каталог | `shared/src/types/products.ts` |
| `useGetKnownSkusQuery`, `useImportKaspiProductsMutation` | Каталог; тег `Product` обновляет список артикулов после импорта | `front/src/features/products/products-api.ts` |
| `useImportKaspiProducts(offers)` | Делит загруженное на новое и сохранённое, сохраняет новое | `front/src/features/products/use-import-kaspi-products.ts` |
| `KaspiCatalogOffer`, `KaspiCatalogPreview` | Контракты разбора выгрузки Kaspi | `shared/src/types/kaspi-catalog.ts` |
| `usePreviewKaspiCatalogMutation` | Отправка выгрузок на разбор | `front/src/features/kaspi-catalog/kaspi-catalog-api.ts` |
| `useFetchKaspiCabinetMutation` | Запуск обхода кабинета Kaspi | `front/src/features/kaspi-catalog/kaspi-catalog-api.ts` |
| `useKaspiCabinet()` | Кука, «запомнить», запуск обхода, счётчики и ошибка; печатает разбор в консоль браузера | `front/src/features/kaspi-catalog/use-kaspi-cabinet.ts` |
| `useCabinetFilters(offers)` | Отбор товаров: статус, проблемы, поиск по артикулу и названиям | `front/src/features/kaspi-catalog/use-cabinet-filters.ts` |
| `KaspiCabinetFetchRequest`, `KaspiCabinetFetchResponse`, `CabinetOffer` | Контракты загрузки из кабинета и разобранный товар | `shared/src/types/kaspi-cabinet.ts` |
| `CabinetWarehouse` | Склад из обхода кабинета: код, `storeId`, счётчики; `cityId` всегда пуст | `shared/src/types/kaspi-cabinet.ts` |
| `CabinetImage`, `CabinetDelivery`, `CabinetStock` | Картинки, флаги доставки и остатки товара кабинета | `shared/src/types/kaspi-cabinet.ts` |
| `CabinetSample` | Пара «сырой товар Kaspi — разобранный нами» для сверки маппинга | `shared/src/types/kaspi-cabinet.ts` |
| `useKaspiCatalogSync()` | Выбор файлов, запуск разбора, результат и ошибка | `front/src/features/kaspi-catalog/use-kaspi-catalog-sync.ts` |
| `SaveWarehousesRequest`, `SaveWarehousesResponse`, `WarehouseDto` | Контракты справочника складов | `shared/src/types/kaspi-catalog.ts` |
| `useGetWarehousesQuery`, `useImportKaspiWarehousesMutation` | Справочник складов; тег `Warehouse` | `front/src/features/warehouses/warehouses-api.ts` |
| `useSaveWarehouses()` | Сохранение складов из выгрузки или кабинета: итог и ошибка | `front/src/features/warehouses/use-save-warehouses.ts` |
| `TreeFolderProps` | Контракт управляемого дерева категорий: выбор, раскрытие, действия, `onMove`, поиск | `front/src/components/tree-folder/page.tsx` |
| `DropdownProps`, `DropdownItem`, `DropdownOption` | Контракт меню и выбора: `mode`, пункты (`label`, `onSelect`, `icon`, `disabled`, `danger`), варианты (`value`, `label`, `note`, `disabled`), `searchable`, `placeholder`, `emptyLabel`, свой триггер, выравнивание | `front/src/components/dropdown/index.tsx` |
| `CheckboxProps` | Контракт чекбокса: `label`, `indeterminate` и нативные атрибуты input | `front/src/components/checkbox/page.tsx` |
| `ModalProps` | Контракт модалки: `open`, `onClose`, `title`, `children`, `footer`, `className` для ширины | `front/src/components/modal/index.tsx` |
| `filterTree(items, search)` | Отбор папок по названию с родителями найденных подпапок; общий для панели и модалки | `front/src/features/categories/filter-tree.ts` |
| `ReorderCategoriesRequest`, `ReorderCategoriesResponse` | Контракт порядка папок уровня | `shared/src/types/catalog.ts` |
| `TablesProps` | Контракт таблицы, children и серверной пагинации | `front/src/components/tables/page.tsx` |
| `DateRangePickerProps`, `DateRange` | Контракт выбора периода: `{ from, to }` в `YYYY-MM-DD`, границы `min`/`max` | `front/src/components/date-range-picker/index.tsx` |
| `buildMonthGrid`, `addMonths`, `fromIso`, `toIso`, `formatMonth`, `orderRange` | Календарная арифметика: сетка 6×7 с хвостами соседних месяцев, разбор дат в местном времени | `front/src/components/date-range-picker/calendar.ts` |
| `useAnchoredPanel(align)` | Всплывающая панель у кнопки: портал, `position: fixed`, разворот вверх при нехватке места, клик вне и Escape. Прокрутка страницы закрывает панель, прокрутка внутри неё — нет. Общий для меню и календаря | `front/src/lib/use-anchored-panel.ts` |
| `LoaderProps` | label, size, hideLabel, className и нативные атрибуты span для Loader | `front/src/components/loader/tree-list.tsx` |
| `cn()` | Склейка Tailwind-классов | `front/src/lib/utils.ts` |
| `CATALOG_PAGE_SIZES`, `CATALOG_DEFAULT_PAGE_SIZE` | Серверные размеры страниц 10/20/50, по умолчанию 20 | `shared/src/constants/catalog.ts` |
| `CATALOG_SEARCH_MAX_LENGTH`, `CATEGORY_NAME_MAX_LENGTH`, `CATALOG_MOVE_MAX_PRODUCTS` | Общие лимиты поиска, имени папки и переноса | `shared/src/constants/catalog.ts` |
| `ALL_PRODUCTS_LABEL` | Название служебного пункта «Все товары» | `shared/src/constants/catalog.ts` |
| `CatalogPageSize` | Тип разрешённого размера страницы | `shared/src/constants/catalog.ts` |
| `CategoryDto`, `CategoryTreeNode`, `CategoryTreeResponse`, `CreateCategoryRequest` | Контракты ручного дерева и создания папок | `shared/src/types/catalog.ts` |
| `RenameCategoryRequest`, `DeleteCategoryResponse` | Контракты переименования и удаления категории | `shared/src/types/catalog.ts` |
| `CatalogQuery`, `CatalogRowDto`, `CatalogResponse` | Контракт страницы артикулов, поиска и фильтра по папке; в строке все поля товара, включая закупку с валютой и поставщика | `shared/src/types/catalog.ts` |
| `CatalogListingDto`, `CatalogStockDto`, `CatalogImageDto`, `CatalogKaspiDto`, `CatalogDeliveryDto` | Блоки строки каталога: размещения, остатки, галерея, поля кабинета, флаги доставки | `shared/src/types/catalog.ts` |
| `CatalogListingDto`, `CatalogStockDto` | Цены по каналам и остатки по складам в строке таблицы | `shared/src/types/catalog.ts` |
| `MoveProductsRequest`, `MoveProductsResponse` | Контракт переноса товаров в папку | `shared/src/types/catalog.ts` |
| `catalogRowSelect` | Явный набор полей БД для таблицы без закупки и истории | `server/src/modules/products/catalog.mapper.ts` |
| `useGetCategoryTreeQuery`, `useCreateCategoryMutation` | Дерево и создание категории, тег Category | `front/src/features/categories/categories-api.ts` |
| `useRenameCategoryMutation`, `useDeleteCategoryMutation` | Переименование/удаление, обновление Category/Product/Audit | `front/src/features/categories/categories-api.ts` |
| `useReorderCategoriesMutation` | Порядок папок уровня; обновление оптимистичное, при ошибке откатывается | `front/src/features/categories/categories-api.ts` |
| `useCategoryActions(onDeleted)` | Формы переименования и подтверждения удаления, перестановка папок (`move`), ошибки и блокировка повтора | `front/src/features/categories/use-category-actions.ts` |
| `useCreateCategoryForm(onCreated)` | Форма новой папки, родитель, валидация и сохранение | `front/src/features/categories/use-create-category-form.ts` |
| `useGetCatalogQuery`, `useMoveProductsToCategoryMutation` | Серверная страница и перенос товаров, тег Product | `front/src/features/products/catalog-api.ts` |
| `useGetKaspiOrdersQuery`, `useLazyGetKaspiOrdersQuery` | Страница заказов Kaspi, разобранная в нашу модель, плюс первый заказ сырым | `front/src/features/orders/orders-api.ts` |
| `KaspiOrderDraft`, `KaspiOrdersPreview` | Контракт разбора заказов: имена полей совпадают с моделью `Order` | `shared/src/types/orders.ts` |
| `SyncKaspiOrdersRequest`, `SyncKaspiOrdersResponse` | Контракт шага синхронизации: период, якорь, курсор, счётчики шага | `shared/src/types/orders.ts` |
| `KASPI_ORDER_PERIODS`, `KASPI_ORDER_PERIOD_LABELS`, `KASPI_ORDER_PERIOD_DAYS` | Периоды кнопок: 3 месяца и 2 года | `shared/src/constants/kaspi-orders.ts` |
| `KASPI_ORDER_CHUNK_DAYS`, `KASPI_ORDER_PAGE_SIZE`, `KASPI_SYNC_DEFAULT_CHUNKS`, `KASPI_SYNC_MAX_CHUNKS` | Ширина отрезка (3 дня), размер страницы Kaspi, сколько отрезков за вызов | `shared/src/constants/kaspi-orders.ts` |
| `useSyncKaspiOrdersMutation` | Один шаг синхронизации; тег `Order` сбрасывается только на последнем | `front/src/features/orders/orders-api.ts` |
| `useKaspiOrdersSync()` | Крутит шаги до `done`, складывает счётчики, даёт прогресс и отмену | `front/src/features/orders/use-kaspi-orders-sync.ts` |
| `useGetOrdersQuery` | Страница заказов из базы, тег `Order` | `front/src/features/orders/orders-api.ts` |
| `useOrdersList()` | Список заказов: серверный поиск по номеру с задержкой 300 мс, период, фильтры по точкам, продавцам и четырём справочникам, страницы | `front/src/features/orders/use-orders-list.ts` |
| `DictionaryFilterField` | Поля запроса заказов, соответствующие пополняемым спискам | `front/src/features/orders/use-orders-list.ts` |
| `OrderListQuery`, `OrderRowDto`, `OrderListResponse` | Контракт списка заказов | `shared/src/types/orders.ts` |
| `useProductCatalog()` | Текущий ответ API, выбор/раскрытие папок, onCategoryCreated/onCategoryDeleted, поиск по товарам и по папкам, страницы и перенос | `front/src/features/products/use-product-catalog.ts` |

### 1.7. Фоновые задачи и воркеры

| Задача | Расписание | Файл |
|---|---|---|
| — | пусто | |

---

## 2. Карта документации (docs)

| Документ | О чём |
|---|---|
| [architecture.md](docs/architecture.md) | Структура монорепозитория, слои `server/`, структура `front/` и `shared/`, модуль дерева категорий и серверного каталога, решения по стеку, команды разработки, известные долги. |
| [api-reference.md](docs/api-reference.md) | Контракты всех эндпоинтов API, включая ручное дерево категорий, серверный список артикулов и перенос товаров: параметры, ответы, коды ошибок. |
| [roadmap.md](docs/roadmap.md) | Roadmap проекта: три планируемых этапа — пользователи; товары (добавление, импорт из МойСклад, папки и карточка, склады); заказы из Kaspi и поставщики. Этапы после 0–3 (закупки, выгрузка на Kaspi, офлайн-заказы, автоматизация, Dashboard, складской учёт, магазин) сохранены с наработками, без сроков. Риски и открытые вопросы. |
| [app-structure.md](docs/app-structure.md) | Дерево маршрутов `front/src/app/`, как работают группы в скобках, почему сайдбар не в корневом layout админки, темы, два входа, где лежат компоненты; страница товаров с TreeFolder/Tables, инструкция добавления children-строк и ручная проверка. |
| [deployment.md](docs/deployment.md) | Единый `.env` в корне и как его находит каждый пакет, список переменных, команды миграций и shadow-база, зависимости сборки; обновление устаревших типов маршрутов через next typegen. |
| [data-model.md](docs/data-model.md) | Модели Prisma пользователей, сессий, складов и каталога; ручные папки Category, служебный пункт «Все товары», Product/Variant, цены, остатки и ткани; список миграций. |
| [analytics-spec.md](docs/analytics-spec.md) | Спецификация аналитического модуля: принципы визуализации (Tufte / Few / Munzner), информационная архитектура из 8 табов, состав графиков и KPI. Источник правды для имплементации дашборда. |
| [kaspi-api-integration.md](docs/kaspi-api-integration.md) | Kaspi Shop API целиком: авторизация по `X-Auth-Token`, шифрование токена, эндпоинты заказов и позиций, стратегия синхронизации, маппинг полей, статусы заказов, схема БД, грабли. Раздел 10 — каталог товаров: разбор XML-выгрузки и JSON кабинета (`list?m=&p=&l=&a=`), маппинг всех полей, три цены и три идентификатора, картинки, штрихкод. Раздел 11 — дерево папок из `categoryPathCodes` и `familyId`. Раздел 12 — чек-лист непроверенного. Раздел 13 — обратное направление: наличие товара ведётся у нас и уходит в Kaspi через XML, поля `storeId`/`preOrder`/`stockCount`/`available` и откуда они берутся. |
| [telegram-bot.md](docs/telegram-bot.md) | Telegram-бот: отправка сообщений и карточек-картинок заказа, маршрутизация получателям (поставщик / склад / доставка), уведомления об отменах и возвратах, cron и расписание, грабли. |

Новые документы создаются в момент первой записи, по правилу «новый код — сразу
в документацию» (п.10 и раздел «Фиксация изменений кода в docs/» в [AGENTS.md](AGENTS.md)).
Незакрытых документов сейчас нет.

---

## 3. Корневые файлы

| Файл | Назначение |
|---|---|
| [AGENTS.md](AGENTS.md) | Конституция проекта: роль, правила поведения, рабочий цикл, структура. Единственный источник правил. |
| [CLAUDE.md](CLAUDE.md) | Входной указатель для Claude Code — импортирует `AGENTS.md` и задаёт порядок чтения. |
| [index.md](index.md) | Этот файл. |
| [CHANGELOG.md](CHANGELOG.md) | Журнал изменений. Запись добавляется только по команде пользователя. |
| [STATUS.md](STATUS.md) | Текущее состояние. Перезаписывается по команде «всё готово». |
