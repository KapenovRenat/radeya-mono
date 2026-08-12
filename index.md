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

Подробные контракты — в [docs/api-reference.md](docs/api-reference.md).

### 1.2. Методы сервисов

| Модуль | Метод | Что делает | Файл |
|---|---|---|---|
| health | `getHealthStatus()` | Статус, окружение, аптайм, доступность базы | `server/src/modules/health/health.service.ts` |
| db | `prisma` | Единственный экземпляр Prisma Client | `server/src/db/client.ts` |
| db | `isDatabaseReachable()` | Проверка соединения с базой | `server/src/db/client.ts` |
| db | `disconnectDatabase()` | Закрытие пула при остановке | `server/src/db/client.ts` |

### 1.3. Модели БД

| Модель | Назначение | Связи |
|---|---|---|
| — | пусто | |

Подробности — в `docs/data-model.md`. Схема проектируется с нуля.

### 1.4. Страницы и маршруты

| URL | Раздел | Файл |
|---|---|---|
| `/` | Магазин — главная (заглушка) | `front/src/app/(shop)/page.tsx` |
| `/dashboard` | Админка — сводка; сейчас проверяет связь с API | `front/src/app/(dashboard)/dashboard/page.tsx` |
| `/login` | Вход (заглушка) | `front/src/app/(auth)/login/page.tsx` |

Целевой состав dashboard — 8 табов аналитики, см. [docs/analytics-spec.md](docs/analytics-spec.md).

### 1.5. Ключевые компоненты

| Компонент | Где используется | Файл |
|---|---|---|
| `RootLayout` | Корень: шрифты, провайдеры, `lang="ru"` | `front/src/app/layout.tsx` |
| `Providers` | Redux-провайдер, стор на клиента | `front/src/app/providers.tsx` |
| `ShopLayout` | Обвязка магазина, класс `theme-shop` | `front/src/app/(shop)/layout.tsx` |
| `DashboardLayout` | Сайдбар админки, класс `theme-dashboard` | `front/src/app/(dashboard)/layout.tsx` |
| `AuthLayout` | Форма по центру, без обвязки | `front/src/app/(auth)/layout.tsx` |
| `Button` | Примитив shadcn/ui (Base UI) | `front/src/components/ui/button.tsx` |

### 1.6. Общие функции, хуки, константы

| Имя | Назначение | Файл |
|---|---|---|
| `USER_ROLES`, `UserRole` | Роли: ADMIN, MANAGER, CLIENT | `shared/src/constants/roles.ts` |
| `USER_STATUSES`, `UserStatus` | Статус учётной записи: PENDING, ACTIVE, REJECTED, BLOCKED | `shared/src/constants/roles.ts` |
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
| [roadmap.md](docs/roadmap.md) | Roadmap проекта: состав системы, 10 этапов с результатом для бизнеса и сроками, детализация ближайших этапов (доступы и роли, Dashboard, Товары, Заказы, автоматизация), риски, открытые вопросы. |
| [analytics-spec.md](docs/analytics-spec.md) | Спецификация аналитического модуля: принципы визуализации (Tufte / Few / Munzner), информационная архитектура из 8 табов, состав графиков и KPI. Источник правды для имплементации дашборда. |
| [kaspi-api-integration.md](docs/kaspi-api-integration.md) | Kaspi Shop API целиком: авторизация по `X-Auth-Token`, шифрование токена, эндпоинты заказов и позиций, стратегия синхронизации, маппинг полей, статусы заказов, схема БД, грабли. |
| [telegram-bot.md](docs/telegram-bot.md) | Telegram-бот: отправка сообщений и карточек-картинок заказа, маршрутизация получателям (поставщик / склад / доставка), уведомления об отменах и возвратах, cron и расписание, грабли. |

### Ещё не созданы

Создаются в момент первой записи, по правилу «новый код — сразу в документацию»
(п.10 и раздел «Фиксация изменений кода в docs/» в [AGENTS.md](AGENTS.md)):

- `data-model.md` — модели Prisma, таблицы, миграции, индексы;
- `app-structure.md` — страницы, маршруты, разделы dashboard, ключевые компоненты `front/`;
- `deployment.md` — окружения, переменные, деплой.

---

## 3. Корневые файлы

| Файл | Назначение |
|---|---|
| [AGENTS.md](AGENTS.md) | Конституция проекта: роль, правила поведения, рабочий цикл, структура. Единственный источник правил. |
| [CLAUDE.md](CLAUDE.md) | Входной указатель для Claude Code — импортирует `AGENTS.md` и задаёт порядок чтения. |
| [index.md](index.md) | Этот файл. |
| [CHANGELOG.md](CHANGELOG.md) | Журнал изменений. Запись добавляется только по команде пользователя. |
| [STATUS.md](STATUS.md) | Текущее состояние. Перезаписывается по команде «всё готово». |
