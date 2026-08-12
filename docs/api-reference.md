# API Reference

> Все эндпоинты `server/`. Формат записи задан в [AGENTS.md](../AGENTS.md),
> раздел «Фиксация изменений кода в docs/».
> Базовый префикс — `/api`. Локально: `http://localhost:4000/api`.

---

## Общее

**Формат ошибки** — одинаковый для всех эндпоинтов (тип `ApiErrorResponse` в `shared`):

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Не найдено",
    "details": { "email": ["Некорректный адрес"] }
  }
}
```

`details` присутствует только у `VALIDATION_ERROR`.

**Коды ошибок:** `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403),
`NOT_FOUND` (404), `CONFLICT` (409), `INTERNAL_ERROR` (500).

---

## Health

### GET /api/health

Проверка, что сервер жив и база отвечает. Используется при разработке и для мониторинга.

- Auth: не требуется
- Параметры: нет
- Ответ 200 — сервер и база в порядке:
  ```json
  {
    "status": "ok",
    "environment": "development",
    "uptimeSeconds": 42,
    "database": "ok",
    "timestamp": "2026-08-12T10:00:00.000Z"
  }
  ```
- Ответ 503 — сервер жив, база недоступна: то же тело с
  `"status": "degraded"` и `"database": "unavailable"`.
- Ошибки: если сервер не поднят — соединение не устанавливается.
- Файл: `server/src/modules/health/health.routes.ts`

> Разные коды ответа нужны мониторингу: 200 — всё хорошо, 503 — требуется вмешательство.
