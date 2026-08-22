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
| `GET /api/users` | Список сотрудников | да | `server/src/modules/users/users.routes.ts` |
| `POST /api/users` | Создание сотрудника | ADMIN | `server/src/modules/users/users.routes.ts` |
| `GET /api/audit` | Журнал действий, постранично | ADMIN | `server/src/modules/audit/audit.routes.ts` |

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
| db | `prisma` | Единственный экземпляр Prisma Client | `server/src/db/client.ts` |
| db | `isDatabaseReachable()` | Проверка соединения с базой | `server/src/db/client.ts` |
| db | `disconnectDatabase()` | Закрытие пула при остановке | `server/src/db/client.ts` |

### 1.3. Модели БД

| Модель | Назначение | Связи |
|---|---|---|
| `User` | Сотрудник: вход в дашборд по логину, роль, должность | `createdBy` / `createdUsers` — self-relation «кто завёл» |
| `Customer` | Клиент магазина: свой вход, телефон обязателен, email нет | — |
| `Session` | Сессия сотрудника; в куке только id, состояние в таблице | `user` → `User`, `onDelete: Cascade` |
| `AuditLog` | Журнал действий, только вставка и чтение | связей нет: логин и роль снимком |
| `UserRole` (enum) | Роли сотрудников: ADMIN, MANAGER, SELLER | — |

Подробности — в [docs/data-model.md](docs/data-model.md).

### 1.4. Страницы и маршруты

| URL | Раздел | Файл |
|---|---|---|
| `/` | Магазин — главная (заглушка) | `front/src/app/(shop)/page.tsx` |
| `/dashboard` | Админка — сводка; сейчас проверяет связь с API | `front/src/app/dashboard/(main)/page.tsx` |
| `/dashboard/login` | Вход сотрудника в админку | `front/src/app/dashboard/(auth)/login/page.tsx` |
| `/dashboard/accounts` | Аккаунты и История: таблица сотрудников, создание, журнал действий | `front/src/app/dashboard/(main)/accounts/page.tsx` |

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
| `Input` | Поле ввода: подпись, ошибка, нативные пропсы | `front/src/components/input/` |
| `Button` | Кнопка: варианты через классы, нативные пропсы | `front/src/components/button/` |
| `AuthGuard` | Пускает в разделы админки только вошедших | `front/src/features/auth/auth-guard.tsx` |
| `UsersTable` | Таблица сотрудников | `front/src/app/dashboard/(main)/accounts/_components/users-table.tsx` |
| `AuditTable` | Таблица журнала действий | `front/src/app/dashboard/(main)/accounts/_components/audit-table.tsx` |
| `CreateUserDialog` | Модалка создания сотрудника на нативном `<dialog>` | `front/src/app/dashboard/(main)/accounts/_components/create-user-dialog.tsx` |

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
| `cn()` | Склейка Tailwind-классов | `front/src/lib/utils.ts` |

### 1.7. Фоновые задачи и воркеры

| Задача | Расписание | Файл |
|---|---|---|
| — | пусто | |

---

## 2. Карта документации (docs)

| Документ | О чём |
|---|---|
| [architecture.md](docs/architecture.md) | Структура монорепозитория, слои `server/`, структура `front/` и `shared/`, решения по стеку, команды разработки, известные долги. |
| [api-reference.md](docs/api-reference.md) | Контракты всех эндпоинтов API: параметры, ответы, коды ошибок. |
| [roadmap.md](docs/roadmap.md) | Roadmap проекта: три планируемых этапа — пользователи; товары (добавление, импорт из МойСклад, папки и карточка, склады); заказы из Kaspi и поставщики. Этапы после 0–3 (закупки, выгрузка на Kaspi, офлайн-заказы, автоматизация, Dashboard, складской учёт, магазин) сохранены с наработками, без сроков. Риски и открытые вопросы. |
| [app-structure.md](docs/app-structure.md) | Дерево маршрутов `front/src/app/`, как работают группы в скобках, почему сайдбар не в корневом layout админки, темы, два входа, где лежат компоненты. |
| [deployment.md](docs/deployment.md) | Единый `.env` в корне и как его находит каждый пакет, список переменных, команды миграций и shadow-база, зависимости сборки. |
| [data-model.md](docs/data-model.md) | Модели Prisma: `User` (сотрудник), `Customer` (клиент магазина), enum `UserRole`, общие правила по id, паролям и отключению записей, список миграций. |
| [analytics-spec.md](docs/analytics-spec.md) | Спецификация аналитического модуля: принципы визуализации (Tufte / Few / Munzner), информационная архитектура из 8 табов, состав графиков и KPI. Источник правды для имплементации дашборда. |
| [kaspi-api-integration.md](docs/kaspi-api-integration.md) | Kaspi Shop API целиком: авторизация по `X-Auth-Token`, шифрование токена, эндпоинты заказов и позиций, стратегия синхронизации, маппинг полей, статусы заказов, схема БД, грабли. |
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
