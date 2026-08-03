# Telegram-бот — отправка заказов и уведомлений (справочник для нового проекта)

> Всё про Telegram-часть: отправка сообщений/фото, рендер карточки-картинки (next/og + Satori),
> маршрутизация заказов получателям, отмены/возвраты, cron, расписание, грабли.
> Экспорт из **radeya-analytics**. Бизнес-кейс: автоотправка заказов Kaspi поставщикам/складу/газелисту в Telegram.

---

## 0. Что делает бот

При появлении заказа Kaspi — формирует **карточку-картинку** (фото товара + инфо) и шлёт нужному получателю в Telegram (личка или группа). Плюс уведомления об отменах/возвратах. Всё автоматически по cron в рабочие часы.

---

## 1. Настройка бота

1. Создать бота у **@BotFather** → получить `TELEGRAM_BOT_TOKEN`.
2. Чтобы слать в **группу** — **добавить бота в группу** (обязательно, иначе `chat not found`).
3. Узнать `chat_id` / `group_id`:
   - Написать боту (личка) или в группу любое сообщение.
   - Открыть `https://api.telegram.org/bot<TOKEN>/getUpdates` → найти `"chat":{"id":...}`.
   - **Супергруппы** имеют id вида `-100...` (13-14 цифр). Обычная группа — `-...`. Личка — положительный.
4. Env: `TELEGRAM_BOT_TOKEN`.

---

## 2. Отправка (Telegram Bot API)

Три способа (файл `lib/telegram.ts`):

```ts
// Текст (HTML)
POST https://api.telegram.org/bot<TOKEN>/sendMessage
  body JSON: { chat_id, text, parse_mode:"HTML", disable_web_page_preview:true }

// Фото по URL (публичный, напр. Cloudinary) + caption
POST .../sendPhoto
  body JSON: { chat_id, photo:<url>, caption, parse_mode:"HTML" }

// Готовая PNG-картинка (буфер) — multipart, без подписи
POST .../sendPhoto
  FormData: chat_id, photo = new Blob([png as BlobPart], {type:"image/png"}), "card.png"
```
Ответ Telegram: `{ ok: true }` или `{ ok:false, description }`. Всегда проверять `data.ok`.

> ⚠️ TypeScript: `Uint8Array` → Blob требует каста `new Blob([png as BlobPart], ...)`.

---

## 3. Карточка-картинка (next/og + Satori)

Весь контент карточки рендерим в **одно PNG** через `ImageResponse` из `next/og` (Satori под капотом). Отправляем буфером (см. выше).

### Ограничения Satori (КРИТИЧНО)
- **Только `display: flex`** (и `none`). Нет grid/float/inline/table.
- **Каждый блок с текстом — свой `<div style={{display:"flex"}}>`.**
- **НЕ использовать React-фрагменты `<>...</>`** внутри flex — Satori кладёт строки внахлёст. Оборачивать условные блоки в `<div style={{display:"flex", flexDirection:"column", gap}}>`.
- Шрифт: **`.woff` (не `.woff2`!)** — Satori woff2 не понимает. Берём Roboto-cyrillic с Fontsource CDN:
  `https://cdn.jsdelivr.net/fontsource/fonts/roboto@latest/cyrillic-<weight>-normal.woff` (weights 400/700/900). Кешировать в модуле.
- Эмодзи: опция `emoji: "twemoji"`.
- `objectFit: "contain"` для фото товара (чтобы не обрезалось); контейнер фикс-размера, `img` 100%×100%.

### Пример вызова
```ts
const resp = new ImageResponse(element, {
  width: 600, height: 800, emoji: "twemoji",
  fonts: [
    { name:"Roboto", data: regular, weight:400, style:"normal" },
    { name:"Roboto", data: bold,    weight:700, style:"normal" },
    { name:"Roboto", data: black,   weight:900, style:"normal" },
  ],
});
return new Uint8Array(await resp.arrayBuffer());
```
### Варианты карточки (наш кейс)
- Фон по типу: **предзаказ → тёмно-красный**, **наличие → тёмно-зелёный** (флаг `isPreorder`).
- `variant: "delivery"` (газелист) — вместо «Отгрузка на Zammler / Дата сдачи» показываем **адрес + телефон клиента + дата доставки**.
- Карточка отмены: баннер «ОТМЕНА»/«ВОЗВРАТ», действие зависит от типа (см. §5).

> ⚠️ `next/og` рендерит **только в рантайме Next.js** — поэтому cron ходит через HTTP-эндпоинт приложения, а не отдельным скриптом (см. §6).

---

## 4. Маршрутизация заказов (кому слать)

Решается по `preOrder` + типу доставки + городу. У получателей роль (`role`) в таблице `suppliers`/recipients:

| Заказ | Условие | Получатель (role) | Триггер-статус |
|---|---|---|---|
| **Предзаказ** | `preOrder=true` | реальный поставщик товара (по артикулу `offer.code` → товар → supplier) | «Предзаказ» |
| **Наличие + Kaspi Доставка** | `preOrder=false`, `isKaspiDelivery` | внутренний склад/кладовщик (`warehouse`) по городу отгрузки | «Упаковка» |
| **Наличие + Своя доставка** | `preOrder=false`, own | газелист (`local_delivery`) по городу клиента | «Упаковка»→own_delivery |
| Самовывоз / прочее | — | пока не шлём | — |

- Матчинг города — нестрого (`toLowerCase().includes`), т.к. «Астана» / «г. Астана».
- **Warehouse** матчим по `originAddressCity` (склад отгрузки), **газелист** — по `deliveryAddressCity` (город клиента).

### Анти-дубль (обязательно)
Таблица `order_dispatches` c **уникальным индексом `(order_id, supplier_name)`**. Перед отправкой — **идемпотентная вставка** `INSERT ... ON CONFLICT DO NOTHING RETURNING id`:
- вернулся id → мы «захватили» слот, шлём;
- конфликт → уже отправлено/отправляется → пропуск.
- Если отправка упала — удаляем строку (можно повторить).
→ заказ уходит получателю **ровно один раз**, даже при гонке cron.

### Rate limiting
- Пауза между сообщениями **~1.5с** (`SEND_DELAY_MS`).
- За один тик cron: не больше N отправок (`MAX_DISPATCH_PER_RUN = 5`) и N отмен (`MAX_CANCEL_PER_RUN = 5`). Остальное — в следующие тики.

---

## 5. Отмены и возвраты

Уведомляем **только тех, кому уже слали заказ** (есть строка в `order_dispatches`, `cancel_notified_at` пуст). Маршрутизация та же, что при отправке (иначе внутренним получателям не дойдёт!).

| Статус Kaspi | Тип уведомления | Действие на карточке |
|---|---|---|
| `CANCELLING` | отмена в пути (`in_transit`) | газелист → «Вернуть на склад»; остальные → «Забрать с Zammler в г. X» |
| `CANCELLED` | отмена клиентом (`by_customer`) | «Складировать» |
| `RETURNED` | возврат (`returned`) | «Принять возврат» |

После успеха — ставим `cancel_notified_at = now()` (чтобы не слать повторно).

---

## 6. Cron (автоотправка)

`next/og` работает только в рантайме приложения → cron не может быть отдельным JS-скриптом. Паттерн: **системный crontab → HTTP-эндпоинт приложения**.

```
POST /api/cron/dispatch     (заголовок x-cron-secret == env CRON_SECRET)
```
Crontab на сервере (раз в минуту):
```
* * * * * curl -s -H "x-cron-secret: XXX" https://<домен>/api/cron/dispatch
```
За вызов (per-store):
1. Gate по интервалу (`cronIntervalMin` + `lastCronRunAt`) — интервал меняется из настроек без правки crontab.
2. Синк заказов 14д + состав (инкрементально, с лимитом шагов).
3. Отбор кандидатов (статус в whitelist, возраст ≥ задержки, ещё не отправлены) → `dispatchOrder`.
4. Отмены: заказы в `order_dispatches` со статусом отмены/возврата и пустым `cancel_notified_at` → `notifyCancellation`.

> Middleware Basic Auth должен **исключать `/api/cron/`** (у cron своя защита `CRON_SECRET`).

### Расписание (рабочие часы)
Отправка (и отмены) — **только пн–сб 08:00–17:00 (Asia/Almaty)**. Вне окна cron синкает, но в Telegram не шлёт; заказы остаются кандидатами и уходят в начале следующего окна (вечерние → утром, воскресные → в понедельник).
```ts
function withinSendWindow(now = new Date()): boolean {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone:"Asia/Almaty", weekday:"short" }).format(now);
  if (wd === "Sun") return false;
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone:"Asia/Almaty", hour:"2-digit", hourCycle:"h23" }).format(now));
  return h >= 8 && h < 17;
}
```

---

## 7. Env-переменные

```
TELEGRAM_BOT_TOKEN=...        # бот
CRON_SECRET=...              # защита cron-эндпоинта
DEFAULT_PRODUCT_IMAGE_URL=... # заглушка-картинка (публичный URL, напр. Cloudinary) для товаров без фото
PUBLIC_BASE_URL=...          # фолбэк для no-image.png (если нет DEFAULT_PRODUCT_IMAGE_URL)
```

---

## 8. Таблицы БД (Telegram-часть)

| Таблица | Поля (суть) |
|---|---|
| `suppliers` (получатели) | `name, role (supplier/warehouse/local_delivery), city, tg_chat_id, tg_group_id` |
| `order_dispatches` | `order_id, order_code, supplier_name, target, status, error, sent_at, cancel_notified_at` + уникальный `(order_id, supplier_name)` |
| `dispatch_settings` | `auto_send_enabled, delay_minutes, cron_interval_min, dop_text, dispatch_from_at, last_cron_run_at` |

- `dispatch_from_at` — точка «слать заказы новее этого момента» (чтобы cron не высыпал весь бэклог при первом включении; null → не шлём ничего).

---

## 9. Грабли (обязательно учесть)

1. **`chat not found`** — бот не добавлен в группу, ИЛИ неверный id (супергруппа `-100...`). Проверять через `getUpdates`.
2. **Satori + фрагменты `<>`** — ломают вёрстку (текст внахлёст). Только `<div flex column>`.
3. **woff2 не поддерживается** Satori — брать `.woff`.
4. **`next/og` только в рантайме** → cron через HTTP-эндпоинт, не скрипт.
5. **Blob каст** `png as BlobPart`.
6. **Отмены для внутренних получателей** — маршрутизация должна совпадать с отправкой (не матчить по имени реального поставщика).
7. **Бэклог** — при включении автоотправки без `dispatch_from_at` cron засыпет все старые заказы. Ставить точку отсечки.
8. **Идемпотентность** — всегда `ON CONFLICT DO NOTHING RETURNING` перед отправкой.
9. **Рабочие часы + rate limit** — не спамить ночью и не превышать лимиты Telegram (пауза + лимит за тик).

---

## 10. Чек-лист реализации в новом проекте

- [ ] `lib/telegram.ts`: sendMessage / sendPhoto(url) / sendPhotoBuffer(multipart).
- [ ] Рендер карточки: `ImageResponse` + Satori (шрифт woff, flex-only, без фрагментов).
- [ ] Таблицы: recipients(role/city), order_dispatches(unique), dispatch_settings.
- [ ] `dispatchOrder`: маршрутизация по preOrder+deliveryType+city, анти-дубль, rate limit.
- [ ] `notifyCancellation`: те же получатели, типы in_transit/by_customer/returned.
- [ ] cron-эндпоинт (CRON_SECRET) + системный crontab, gate по интервалу и рабочему окну.
- [ ] Заглушка-картинка через env.
```
