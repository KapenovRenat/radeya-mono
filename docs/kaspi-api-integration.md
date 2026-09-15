# Kaspi Shop API — полная интеграция (справочник для нового проекта)

> Всё про работу с Kaspi Merchant/Shop API: авторизация, шифрование токена, эндпоинты,
> синхронизация, маппинг полей, статусы заказов, БД, грабли.
> Экспорт из проекта **radeya-analytics** (Next.js + Drizzle + PostgreSQL).
> Цель: скормить в новую сессию, чтобы помощник знал, как реализовывать с нуля.

---

## 0. Общая картина

```
Kaspi Merchant Cabinet → выдаёт постоянный API-токен (X-Auth-Token)
     │
     │  (токен шифруется Fernet и хранится в БД: kaspi_stores.encrypted_token)
     ▼
GET https://kaspi.kz/shop/api/v2/orders           — список заказов (по датам, постранично)
GET .../orders/{id}/entries                        — состав заказа (позиции/SKU)
GET .../orders/{id}                                — детальный заказ
     │
     ▼
Синк (chunked, stateful) → раскладываем в таблицы kaspi_orders / kaspi_order_entries
     │
     ▼
Бизнес-логика: статусы, маршрутизация, Telegram-уведомления
```

Формат ответов Kaspi — **JSON:API** (`{ data: [{ id, type, attributes, relationships }], meta, included }`).

---

## 1. Авторизация

- Токен берётся продавцом в **Kaspi Merchant Cabinet** (Настройки → API). Постоянный.
- Передаётся в заголовке **`X-Auth-Token`** на каждый запрос.
- Обязательные заголовки:
  ```
  X-Auth-Token: <token>
  Accept: application/vnd.api+json;charset=UTF-8
  User-Agent: Mozilla/5.0 ... Chrome/120 ...   (без него бывает 403/блок)
  ```

### Хранение токена — шифрование Fernet (важно)

Токен НЕ храним в открытом виде. Шифруем **Python-совместимым Fernet** (чтобы был совместим с легаси):

- Ключ = `PBKDF2-HMAC-SHA256(password = JWT_SECRET_KEY, salt = "kaspi-token-encryption-salt-v1", iterations = 100000, dklen = 32)`
- Первые 16 байт ключа — HMAC-подпись, последние 16 — AES-128 ключ.
- Токен Fernet v0x80: `base64url( 0x80 | timestamp(8, BE) | IV(16) | AES-128-CBC(PKCS7) | HMAC-SHA256(32) )`
- `JWT_SECRET_KEY` — env, **должен совпадать между окружениями**, иначе токены из дампа не расшифруются.

> В новом проекте, если легаси-совместимость не нужна — можно взять любое симметричное шифрование (AES-GCM). Но принцип: **токен в БД зашифрован, ключ в env**.

---

## 2. Эндпоинты

### 2.1 Список заказов — `GET /orders`

Query-параметры:
```
page[number]=0                                  # с нуля
page[size]=100                                  # до 100
filter[orders][creationDate][$ge]=<ms>          # от (Unix ms)
filter[orders][creationDate][$le]=<ms>          # до (Unix ms)
filter[orders][code]=980052874                  # (опц.) по номеру заказа
filter[orders][state]=...  filter[orders][status]=...   # (опц.)
```
- Даты — **Unix-миллисекунды (UTC)**.
- Пагинация: сначала `page[number]=0`, из `meta.pageCount` узнаём число страниц, затем догружаем.
- Ответ: `{ data: KaspiOrder[], meta: { totalCount, pageCount, pageNumber, pageSize } }`.

**⚠️ Ограничение пагинации:** Kaspi реально отдаёт **~10k позиций на диапазон**. Поэтому нельзя тянуть год одним запросом — бьём на **чанки по 3 дня** (`MAX_KASPI_DATE_RANGE_DAYS = 3`).

### 2.2 Состав заказа — `GET /orders/{id}/entries`

- `{id}` = `data[].id` из списка (JSON:API resource id, НЕ номер заказа).
- `page[size]=100`.
- Ответ `data[]` c `attributes`: `entryNumber, quantity, basePrice, totalPrice, deliveryCost, category{code,title}, offer{code,name}` + `relationships.product.data.id`.
- **`offer.code` = артикул** (то, по чему матчим с товарами продавца).

### 2.3 Детальный заказ — `GET /orders/{id}`

- Иногда отдаёт больше полей, чем список (проверять на реальных данных — напр. адрес доставки).
- `?include[orders]=user` — подтянуть данные покупателя (relationships).

---

## 3. Синхронизация (chunked, stateful)

Почему так: у Kaspi лимит пагинации + у serverless (Vercel) лимит 60с на функцию. Решение — **один чанк за вызов**, состояние в БД, UI поллит до `done`.

### 3.1 Синк заказов
- Диапазон (напр. год или 14 дней) → `buildChunks(from, to, 3дня)` → массив чанков.
- Состояние в `kaspi_sync_state`: `overallStart, overallEnd, totalChunks, chunksDone, ordersSynced, status`.
- Каждый вызов `stepSync`: берёт следующий чанк → `fetchOrdersForChunk(token, chunk)` (все страницы чанка) → `mapKaspiOrder` → **upsert батчами по 500** в `kaspi_orders` (`onConflictDoUpdate` по orderCode/id). `chunksDone++`.
- Параллелизм при массовой тяге — до 8 (`DEFAULT_PARALLEL_LIMIT`).
- `force: true` — перезапуск синка (для инкрементального обновления последних N дней).

### 3.2 Синк состава (entries) — отдельно
- Тянется **по одному заказу** (`/orders/{id}/entries`), поэтому дорого → отдельный процесс.
- `startEntriesSync`: считает заказы без entries. `stepEntriesSync`: берёт **батч 20** заказов без entries (parallel 6), тянет их состав, вставляет в `kaspi_order_entries` (`onConflictDoNothing`).
- Для заказов с 0 позиций (или ошибкой) вставляем **stub-строку** (`entryNumber = -1`), чтобы не тянуть их бесконечно.
- Состояние — `kaspi_entries_sync_state`.

### 3.3 Инкрементальный синк (cron/кнопка «обновить 14 дней»)
```
runOrdersSync(storeId):   startSync(from = now-14д, to = now, force) → крутим stepSync пока running
runEntriesSync(storeId):  startEntriesSync → крутим stepEntriesSync с лимитом шагов за вызов
```

---

## 4. Маппинг полей: Kaspi attributes → БД

`mapKaspiOrder(apiOrder, storeId)` (raw сохраняем целиком в `raw_data` jsonb):

| Kaspi (`attributes.*`) | Колонка БД | Примечание |
|---|---|---|
| `code` | `order_code` | номер заказа (обязателен) |
| `creationDate` (ms) | `creation_date` | дата поступления |
| `approvedByBankDate` | `approved_by_bank_date` | |
| `totalPrice` | `total_price` | |
| `deliveryCostForSeller` / `deliveryCost` | `delivery_cost_for_seller` / `delivery_cost` | |
| `status` | `status` | Kaspi-статус (см. §5) |
| `state` | `state` | стадия/состояние |
| `cancellationReason` | `cancellation_reason` | причина отмены |
| `paymentMode`, `creditTerm` | `payment_mode`, `credit_term` | |
| `deliveryMode` | `delivery_mode` | тип доставки |
| `isKaspiDelivery` | `is_kaspi_delivery` | Kaspi доставка? |
| `assembled` | `assembled` | собран/упакован |
| `kaspiDelivery.waybillNumber` | `waybill_number` | накладная |
| `kaspiDelivery.express` | `is_express` | |
| `customer.{firstName,lastName,name}` | `customer_name` | |
| `customer.cellPhone` | `customer_cell_phone` | |
| `deliveryAddress.town` | `delivery_address_city` | ⚠️ у Kaspi-доставки часто пусто |
| `deliveryAddress.formattedAddress` | `delivery_address_formatted` | адрес клиента (для своей доставки) |
| `originAddress.city.name` | `origin_address_city` | город склада отгрузки |
| `originAddress.address.formattedAddress` | `origin_address_formatted` | |
| весь объект | `raw_data` (jsonb) | сырой ответ Kaspi as-is |

**Поля из `raw_data.attributes`, которых нет отдельными колонками, но важны:**
- `preOrder` (bool) — **предзаказ** (товара нет в наличии).
- `plannedDeliveryDate` (ms) — плановая доставка клиенту.
- `kaspiDelivery.courierTransmissionDate` (ms) — фактическая передача курьеру (проставлена → «переданы на доставку»).
- `kaspiDelivery.courierTransmissionPlanningDate` (ms) — **план передачи курьеру** = дедлайн «Отвезите в пункт приёма».
- `kaspiDelivery.returnedToWarehouse` (bool) — гипотеза: вернулся на склад (проверить).

---

## 5. Статусы заказов (полная модель)

### 5.1 Поля-источники
`status`, `state`, `waybillNumber`, `preOrder`, `assembled`, `courierTransmissionDate`, `deliveryMode`, `isKaspiDelivery`.

Возможные значения:
- `status`: `APPROVED_BY_BANK`, `ACCEPTED_BY_MERCHANT`, `COMPLETED`, `CANCELLING`, `CANCELLED`, `RETURNED` (+ `RETURN_REQUESTED`/`KASPI_DELIVERY_RETURN_REQUESTED` — уточнять).
- `state`: `NEW`, `SIGN_REQUIRED`, `PICKUP`, `DELIVERY`, `KASPI_DELIVERY`, `ARCHIVE`.
- `deliveryMode`: `DELIVERY_PICKUP`, `DELIVERY_LOCAL`, `DELIVERY_REGIONAL_*`.

### 5.2 Два измерения
1. **Тип доставки** (фиксирован): Kaspi Доставка / Самовывоз / Своя доставка.
2. **Стадия**: Новый → (Предзаказ | Упаковка) → Передача → Переданы → Доставлен + отмены/возвраты.
Плюс флаг `preOrder`.

### 5.3 Алгоритм (сверху вниз, первый сработавший)
```
CANCELLED                     → Отменён
RETURNED                      → Возврат
RETURN_REQUESTED              → Ожидают решения по возврату
CANCELLING                    → Ожидают возврата/отмены
COMPLETED / DELIVERED         → Доставлен
ACCEPTED_BY_MERCHANT | waybill (принят):
    preOrder                  → Предзаказ
    deliveryType = pickup     → Самовывоз
    deliveryType = own        → Своя доставка
    courierTransmissionDate   → Переданы на доставку
    assembled                 → Передача
    иначе                     → Упаковка
state = SIGN_REQUIRED         → На подписании
иначе                         → Новый
```
**Тип доставки:**
```
state = PICKUP                             → pickup (самовывоз клиентом)
state = KASPI_DELIVERY | isKaspiDelivery   → kaspi
isKaspiDelivery = false                    → own (своя доставка)
иначе                                      → kaspi
```
⚠️ Не путать `DELIVERY_REGIONAL_PICKUP` (это Kaspi-доставка в ПВЗ) с настоящим самовывозом (`state=PICKUP`).

### 5.4 Готовый код — см. отдельный `kaspi-order-statuses-guide.md` (функции `deliveryType` + `mapOrderStatus`).

---

## 6. Важные бизнес-даты

- **«Принят мерчантом»** = `status=ACCEPTED_BY_MERCHANT` ИЛИ появился `waybillNumber` (накладная надёжнее — статус меняется не сразу).
- **Дата сдачи поставщику** (наш кейс) = `courierTransmissionPlanningDate − 2 дня` (Asia/Almaty). «Планируемой даты прибытия» в API НЕТ — есть только передача курьеру и доставка.
- **Все даты — Unix ms (UTC)**. Для отображения форматировать в нужный пояс (`Asia/Almaty`, UTC+5).

---

## 7. Таблицы БД (PostgreSQL + Drizzle)

| Таблица | Назначение |
|---|---|
| `kaspi_stores` | Магазины. `encrypted_token` (Fernet), реквизиты. |
| `kaspi_orders` | Заказы (колонки из §4 + `raw_data` jsonb). |
| `kaspi_order_entries` | Позиции заказа (SKU): `order_id, offer_code, offer_name, category_*, quantity, base_price, total_price`. |
| `kaspi_sync_state` | Прогресс синка заказов (чанки). |
| `kaspi_entries_sync_state` | Прогресс синка состава. |

Индексы: уникальность заказа по `(store_id, order_code)` (или по Kaspi id); entries — по `(order_id, entry_number)`.

---

## 8. Грабли (обязательно учесть)

1. **Пагинация ~10k** на диапазон → чанки по 3 дня.
2. **60с лимит serverless** → синк по одному чанку за вызов, состояние в БД, поллинг.
3. **User-Agent обязателен** — без него Kaspi может отдать 403.
4. **Адрес клиента:** для **Kaspi Доставки** `deliveryAddress` часто **пустой** (Kaspi не отдаёт домашний адрес — приватность; вместо него «точка передачи» = ПВЗ/Zammler). Полный адрес есть у **своей доставки**. Проверять `детальный /orders/{id}` — иногда полей больше.
5. **Артикул = `offer.code`** из entries, матчить с кодом товара продавца (напр. из МойСклад/Excel).
6. **`entryNumber`** уникален внутри заказа — ключ для upsert позиций. Stub `-1` для заказов без позиций.
7. **Таймзона:** ms в UTC; границы дат для фильтров и отображение — считать в UTC+5 (Almaty), иначе «съезжает» день.
8. **Токен:** один и тот же `JWT_SECRET_KEY` между окружениями (иначе дамп с зашифрованными токенами не расшифруется).

---

## 9. Что реализовать в новом проекте (чек-лист)

- [ ] Модель `stores` c зашифрованным токеном + функции encrypt/decrypt.
- [ ] Kaspi HTTP-клиент: `fetchOrdersPage`, `fetchOrderEntries`, `fetchOrder` (headers, JSON:API).
- [ ] `buildChunks(from,to,3)` + пагинация внутри чанка.
- [ ] Stateful синк заказов (state-таблица, step-функция, upsert).
- [ ] Отдельный синк состава (батч, parallel, stub для пустых).
- [ ] `mapKaspiOrder` (attributes → колонки, raw в jsonb).
- [ ] `deliveryType` + `mapOrderStatus` (см. отдельный гайд).
- [ ] Инкрементальный синк последних N дней (cron/кнопка).
- [ ] (Опц.) Telegram-уведомления — см. `telegram-bot.md`.

---

## 10. Выгрузка каталога товаров — парсинг кабинета

**Решение принято, детали проектируются на этапе 2.**

Официальный API отдаёт только заказы. Каталога товаров в нём нет: в позициях заказа
приходит лишь `offer.code` (артикул) и название, без фотографий и характеристик.
Поэтому товары забираются **парсингом кабинета продавца**.

### Что нужно получить

Все товары — и в продаже, и снятые с продажи: название, артикул, первое превью-фото,
цена, наличие, признак публикации. Полный список полей уточняется на этапе 2.

### Как заходим

Вход в кабинет — **только логин и пароль**, без SMS-кода и капчи. Значит автоматизация
полная: воркер логинится сам, полуручной режим с ручным входом раз в месяц не нужен.

Реализация — **headless-браузер (Playwright)**, а не HTTP-клиент с куками: кабинет
рисуется скриптами, в исходном HTML данных нет.

### Обязательные требования

- **Логин и пароль — только в корневом `.env`**, никогда в коде и не в git.
  По возможности отдельная учётная запись с минимальными правами.
- **Проверка результата обязательна.** Не нашли ожидаемые поля — это **ошибка**,
  а не «ноль товаров». Иначе редизайн кабинета молча обнулит каталог.
- **Пауза между обращениями.** Частые запросы приводят к блокировке по IP.
- **Лог каждого обмена** — что запросили, что получили, сколько разобрали.
- **Изоляция в отдельный модуль** `server/src/modules/kaspi-catalog/`: парсер
  ломается чаще всего, и его починка не должна задевать остальной код.
- **Ручной режим как запасной** — загрузка файлом, если парсер лежит.

### Чего делать не будем

Заказы парсингом не берём — для них есть API. Парсер сломается на первом редизайне,
а API стабилен: дублировать его разметкой значит менять надёжный путь на хрупкий.
