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
| `GET /api/audit` | Журнал действий, постранично | ADMIN | `server/src/modules/audit/audit.routes.ts` |
| `POST /api/kaspi-catalog/preview` | Разбор выгрузок ACTIVE/ARCHIVE, без записи в БД | ADMIN | `server/src/modules/kaspi-catalog/kaspi-catalog.routes.ts` |
| `POST /api/kaspi-catalog/fetch` | Обход каталога в кабинете Kaspi: товары и сводка складов, без записи в БД | ADMIN | `server/src/modules/kaspi-catalog/kaspi-catalog.routes.ts` |
| `GET /api/warehouses` | Справочник складов | ADMIN | `server/src/modules/warehouses/warehouses.routes.ts` |
| `POST /api/warehouses/import-kaspi` | Импорт складов из предпросмотра выгрузки, повторяемый | ADMIN | `server/src/modules/warehouses/warehouses.routes.ts` |
| `GET /api/products/skus` | Артикулы, уже сохранённые в каталоге | ADMIN | `server/src/modules/products/products.routes.ts` |
| `POST /api/products/import-kaspi` | Сохранение загруженных товаров в каталог; создаёт только новые | ADMIN | `server/src/modules/products/products.routes.ts` |
| `GET /api/categories` | Дерево ручных папок и служебный пункт «Все товары» | ADMIN | `server/src/modules/categories/categories.controller.ts` |
| `POST /api/categories` | Создать корневую папку или подпапку | ADMIN | `server/src/modules/categories/categories.controller.ts` |
| `PATCH /api/categories/:id` | Переименовать папку, сохраняя родителя | ADMIN | `server/src/modules/categories/categories.controller.ts` |
| `DELETE /api/categories/:id` | Удалить только пустую папку | ADMIN | `server/src/modules/categories/categories.controller.ts` |
| `GET /api/products/variants` | Серверный поиск, поддерево категории, страницы 10/20/50 | ADMIN | `server/src/modules/products/catalog.controller.ts` |
| `PATCH /api/products/category` | Перенести товары со всеми модификациями в папку | ADMIN | `server/src/modules/products/catalog.controller.ts` |

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
| audit | `logAction(input)` | Запись в журнал; сбой не роняет операцию | `server/src/lib/audit.ts` |
| users | `listUsers()` | Сотрудники, свежие сверху | `server/src/modules/users/users.service.ts` |
| users | `createUser(input, createdById)` | Создание; дубль логина → 409 | `server/src/modules/users/users.service.ts` |
| users | `toUserListItem(user)` | DTO наружу без `passwordHash` | `server/src/modules/users/users.service.ts` |
| audit | `listAuditLog(page)` | Страница журнала по 50 записей | `server/src/modules/audit/audit.service.ts` |
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
| — | `kaspi-api-probe` | Разведочный скрипт: что отдаёт Kaspi по токену. Запуск `npx tsx src/scripts/kaspi-api-probe.ts` из `server/` | `server/src/scripts/kaspi-api-probe.ts` |
| products | `listKnownSkus()` | Артикулы, уже лежащие в базе | `server/src/modules/products/products.service.ts` |
| products | `importKaspiProducts(input, authorId)` | Импорт товаров кабинета: только новые, отчёт по пропущенным и сбойным | `server/src/modules/products/products.service.ts` |
| db | `prisma` | Единственный экземпляр Prisma Client | `server/src/db/client.ts` |
| db | `isDatabaseReachable()` | Проверка соединения с базой | `server/src/db/client.ts` |
| db | `disconnectDatabase()` | Закрытие пула при остановке | `server/src/db/client.ts` |
| categories | `getCategoryTree()` | Дерево папок одним запросом, «Все товары» отдельно | `server/src/modules/categories/categories.service.ts` |
| categories | `createCategory(input)` | Создать корневую папку/подпапку (два уровня), проверить дубли, заполнить path | `server/src/modules/categories/categories.service.ts` |
| categories | `renameCategory(id, name)` | Переименовать с проверкой дублей; before/after для аудита | `server/src/modules/categories/categories.service.ts` |
| categories | `deleteCategory(id)` | Заблокировать запись и удалить только без товаров/подпапок | `server/src/modules/categories/categories.service.ts` |
| products | `listCatalog(input)` | Страница артикулов с поиском и фильтром по поддереву | `server/src/modules/products/catalog.service.ts` |
| products | `moveProductsToCategory(input)` | Атомарный перенос Product, старые категории для аудита | `server/src/modules/products/catalog.service.ts` |
| products | `toCatalogRow(row)` | Безопасный DTO строки, точные цены и миниатюра | `server/src/modules/products/catalog.mapper.ts` |

### 1.3. Модели БД

| Модель | Назначение | Связи |
|---|---|---|
| `User` | Сотрудник: вход в дашборд по логину, роль, должность | `createdBy` / `createdUsers` — self-relation «кто завёл» |
| `Customer` | Клиент магазина: свой вход, телефон обязателен, email нет | — |
| `Session` | Сессия сотрудника; в куке только id, состояние в таблице | `user` → `User`, `onDelete: Cascade` |
| `AuditLog` | Журнал действий, только вставка и чтение | связей нет: логин и роль снимком |
| `Warehouse` | Склад Kaspi: код `PP3`, `kaspiStoreId`, КАТО, наше название, снимок товаров и остатка | `stocks` → `VariantStock` |
| `Category` | Папка каталога, наше дерево с `path` | self-relation `parent` / `children`, `products` |
| `Product` | Карточка модели: название, категория, бренд, `kaspiFamilyId` | `category`, `variants` |
| `Variant` | Артикул: поля кабинета, статус продажи, флаги доставки, закупка, ткань | `product`, `listings`, `stocks`, `changes`, `fabric`, `fabricShade` |
| `Listing` | Размещение на канале: цена, статус, ID площадки | `variant`; `@@unique([variantId, channel])` |
| `VariantStock` | Остаток артикула на складе и срок предзаказа | `variant`, `warehouse` |
| `Fabric` | Ткань обивки: наш справочник, Kaspi её не знает | `shades`, `variants` |
| `FabricShade` | Оттенок ткани, принадлежит своей ткани | `fabric`, `variants` |
| `VariantChange` | История изменений артикула: поле, было, стало, источник | `variant` |
| `UserRole` (enum) | Роли сотрудников: ADMIN, MANAGER, SELLER | — |
| `SalesChannel` (enum) | Каналы продаж: SITE, KASPI, OZON | — |
| `ListingStatus` (enum) | Статус размещения: ON_SALE, OFF_SALE | — |
| `ChangeSource` (enum) | Источник изменения: KASPI_SYNC, MANUAL | — |

Подробности — в [docs/data-model.md](docs/data-model.md).

### 1.4. Страницы и маршруты

| URL | Раздел | Файл |
|---|---|---|
| `/` | Магазин — главная (заглушка) | `front/src/app/(shop)/page.tsx` |
| `/dashboard` | Админка — сводка; сейчас проверяет связь с API | `front/src/app/dashboard/(main)/page.tsx` |
| `/dashboard/login` | Вход сотрудника в админку | `front/src/app/dashboard/(auth)/login/page.tsx` |
| `/dashboard/accounts` | Аккаунты и История: таблица сотрудников, создание, журнал действий | `front/src/app/dashboard/(main)/accounts/page.tsx` |
| `/dashboard/products` | Каталог: два уровня папок, создание/переименование/удаление категорий, серверный поиск и таблица с пагинацией; строки ожидают children | `front/src/app/dashboard/(main)/products/page.tsx` |
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
| `TreeFolder` | Два уровня папок: выбор, раскрытие, создание подпапки, переименование и удаление | `front/src/components/tree-folder/index.tsx`, `front/src/components/tree-folder/style.module.scss` |
| `Tables` | Таблица с children-строками, head и серверной пагинацией 10/20/50 | `front/src/components/tables/index.tsx`, `front/src/components/tables/style.module.scss` |
| `ProductsLayout` | Защита раздела товаров ролью ADMIN | `front/src/app/dashboard/(main)/products/layout.tsx` |
| `Loader` | Сегментное кольцо #f23428; size задаёт диаметр, hideLabel скрывает текст; label по умолчанию «Загрузка ...», подсветка букв каждые 160 мс | `front/src/components/loader/tree-list.tsx`, `front/src/components/loader/style.module.scss` |
| `Input` | Поле ввода: подпись, ошибка, нативные пропсы | `front/src/components/input/` |
| `Button` | Кнопка: варианты через классы, нативные пропсы | `front/src/components/button/` |
| `AuthGuard` | Пускает в разделы админки только вошедших | `front/src/features/auth/auth-guard.tsx` |
| `RoleGuard` | Ограничение раздела по ролям с редиректом | `front/src/features/auth/role-guard.tsx` |
| `UsersTable` | Таблица сотрудников | `front/src/app/dashboard/(main)/accounts/_components/users-table.tsx` |
| `AuditTable` | Таблица журнала действий | `front/src/app/dashboard/(main)/accounts/_components/audit-table.tsx` |
| `CreateUserDialog` | Модалка создания сотрудника на нативном `<dialog>` | `front/src/app/dashboard/(main)/accounts/_components/create-user-dialog.tsx` |
| `CatalogSummary` | Счётчики разбора выгрузки над таблицей товаров | `front/src/app/dashboard/(main)/kaspi-sync/_components/catalog-summary.tsx` |
| `WarehousesPanel` | Таблица складов и сохранение их в справочник; общая для выгрузки и кабинета | `front/src/app/dashboard/(main)/kaspi-sync/_components/warehouses-panel.tsx` |
| `ProductsImportPanel` | Счётчик новых товаров и сохранение их в каталог | `front/src/app/dashboard/(main)/kaspi-sync/_components/products-import-panel.tsx` |
| `CatalogTable` | Таблица разобранных товаров Kaspi | `front/src/app/dashboard/(main)/kaspi-sync/_components/catalog-table.tsx` |
| `CatalogPagination` | Панель пагинации под таблицей: размер страницы, номера, диапазон | `front/src/app/dashboard/(main)/kaspi-sync/_components/catalog-pagination.tsx` |
| `CabinetFetch` | Кука, запуск загрузки из кабинета, счётчики, склады, фильтр и таблица | `front/src/app/dashboard/(main)/kaspi-sync/_components/cabinet-fetch.tsx` |
| `CabinetTable` | Таблица товаров из кабинета: картинка, штрихкод, цены со скидкой, размер | `front/src/app/dashboard/(main)/kaspi-sync/_components/cabinet-table.tsx` |

### 1.6. Общие функции, хуки, константы

| Имя | Назначение | Файл |
|---|---|---|
| `USER_ROLES`, `UserRole` | Роли сотрудников: ADMIN, MANAGER, SELLER | `shared/src/constants/roles.ts` |
| `USER_ROLE_LABELS` | Подписи ролей для интерфейса | `shared/src/constants/roles.ts` |
| `AUDIT_ACTIONS`, `AUDIT_ACTION_LABELS` | Действия для журнала и их подписи | `shared/src/constants/audit-actions.ts` |
| `LOGIN_PATTERN`, `PASSWORD_PATTERN`, `normalizeLogin()` | Правила логина и пароля, общие для сервера и формы | `shared/src/constants/credentials.ts` |
| `LoginRequest`, `AuthUser`, `AuthResponse` | Контракты входа | `shared/src/types/auth.ts` |
| `requireAuth`, `requireRole(...roles)` | Проверка сессии и ролей | `server/src/middlewares/require-auth.ts` |
| `SESSION_COOKIE_NAME`, `sessionCookieOptions` | Настройки куки сессии | `server/src/config/session.ts` |
| `ORDER_SOURCES`, `ORDER_SOURCE_LABELS` | Источники заказов: SITE, KASPI, OFFLINE | `shared/src/constants/order-sources.ts` |
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
| `TreeFolderProps` | Контракт управляемого дерева категорий | `front/src/components/tree-folder/index.tsx` |
| `TablesProps` | Контракт таблицы, children и серверной пагинации | `front/src/components/tables/index.tsx` |
| `LoaderProps` | label, size, hideLabel, className и нативные атрибуты span для Loader | `front/src/components/loader/tree-list.tsx` |
| `cn()` | Склейка Tailwind-классов | `front/src/lib/utils.ts` |
| `CATALOG_PAGE_SIZES`, `CATALOG_DEFAULT_PAGE_SIZE` | Серверные размеры страниц 10/20/50, по умолчанию 20 | `shared/src/constants/catalog.ts` |
| `CATALOG_SEARCH_MAX_LENGTH`, `CATEGORY_NAME_MAX_LENGTH`, `CATALOG_MOVE_MAX_PRODUCTS` | Общие лимиты поиска, имени папки и переноса | `shared/src/constants/catalog.ts` |
| `ALL_PRODUCTS_LABEL` | Название служебного пункта «Все товары» | `shared/src/constants/catalog.ts` |
| `CatalogPageSize` | Тип разрешённого размера страницы | `shared/src/constants/catalog.ts` |
| `CategoryDto`, `CategoryTreeNode`, `CategoryTreeResponse`, `CreateCategoryRequest` | Контракты ручного дерева и создания папок | `shared/src/types/catalog.ts` |
| `RenameCategoryRequest`, `DeleteCategoryResponse` | Контракты переименования и удаления категории | `shared/src/types/catalog.ts` |
| `CatalogQuery`, `CatalogRowDto`, `CatalogResponse` | Контракт страницы артикулов, поиска и фильтра по папке | `shared/src/types/catalog.ts` |
| `CatalogListingDto`, `CatalogStockDto` | Цены по каналам и остатки по складам в строке таблицы | `shared/src/types/catalog.ts` |
| `MoveProductsRequest`, `MoveProductsResponse` | Контракт переноса товаров в папку | `shared/src/types/catalog.ts` |
| `catalogRowSelect` | Явный набор полей БД для таблицы без закупки и истории | `server/src/modules/products/catalog.mapper.ts` |
| `useGetCategoryTreeQuery`, `useCreateCategoryMutation` | Дерево и создание категории, тег Category | `front/src/features/categories/categories-api.ts` |
| `useRenameCategoryMutation`, `useDeleteCategoryMutation` | Переименование/удаление, обновление Category/Product/Audit | `front/src/features/categories/categories-api.ts` |
| `useCategoryActions(onDeleted)` | Формы переименования и подтверждения удаления, ошибки и блокировка повтора | `front/src/features/categories/use-category-actions.ts` |
| `useCreateCategoryForm(onCreated)` | Форма новой папки, родитель, валидация и сохранение | `front/src/features/categories/use-create-category-form.ts` |
| `useGetCatalogQuery`, `useMoveProductsToCategoryMutation` | Серверная страница и перенос товаров, тег Product | `front/src/features/products/catalog-api.ts` |
| `useProductCatalog()` | Текущий ответ API, выбор/раскрытие папок, onCategoryCreated/onCategoryDeleted, поиск, страницы и перенос | `front/src/features/products/use-product-catalog.ts` |

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
| [kaspi-api-integration.md](docs/kaspi-api-integration.md) | Kaspi Shop API целиком: авторизация по `X-Auth-Token`, шифрование токена, эндпоинты заказов и позиций, стратегия синхронизации, маппинг полей, статусы заказов, схема БД, грабли. Раздел 10 — каталог товаров: разбор XML-выгрузки и JSON кабинета (`list?m=&p=&l=&a=`), маппинг всех полей, три цены и три идентификатора, картинки, штрихкод. Раздел 11 — дерево папок из `categoryPathCodes` и `familyId`. Раздел 12 — чек-лист непроверенного. |
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
