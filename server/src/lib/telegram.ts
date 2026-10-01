import { env } from '../config/env';
import { AppError } from './errors';

/**
 * Отправка в Telegram через Bot API. Подробности и грабли — docs/telegram-bot.md.
 *
 * Токен уходит только в адрес запроса: адрес нигде не логируется,
 * в текст ошибки попадает лишь ответ Telegram.
 */

const TELEGRAM_API = 'https://api.telegram.org';

/** Telegram отвечает быстро; пятнадцать секунд — уже «не отвечает». */
const TELEGRAM_TIMEOUT_MS = 15_000;

export function isTelegramConfigured(): boolean {
  return env.TELEGRAM_BOT_TOKEN !== undefined;
}

/** Текстовое сообщение с HTML-разметкой: `<b>`, `<i>`, `<code>`. */
export async function sendTelegramMessage(chatId: string, html: string): Promise<void> {
  await callTelegram('sendMessage', {
    chat_id: chatId,
    text: html,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });
}

/** Экранирование для parse_mode HTML: без него `<` в тексте ошибки сломает сообщение. */
export function escapeTelegramHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function callTelegram(method: string, body: Record<string, unknown>): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new AppError(503, 'TELEGRAM_TOKEN_MISSING', 'Не задан TELEGRAM_BOT_TOKEN в .env');
  }

  let response: Response;

  try {
    response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'неизвестная причина';

    throw new AppError(502, 'TELEGRAM_UNAVAILABLE', `Telegram не ответил: ${reason}`);
  }

  // Ответ Telegram всегда `{ ok, description? }` — даже при ошибке с кодом 400.
  const data = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;

  if (data?.ok !== true) {
    throw new AppError(
      502,
      'TELEGRAM_FAILED',
      `Telegram отклонил сообщение: ${data?.description ?? `код ${response.status}`}`,
    );
  }
}
