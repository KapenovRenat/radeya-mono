import {
  WORKER_EVENT_TYPES,
  WORKER_KEYS,
  type DispatchKind,
  type WorkerEventType,
} from '@radeya/shared';

import { prisma } from '../../../../../db/client';
import type { WorkerSettings } from '../../../../../generated/prisma/client';
import { sendTelegramPhoto } from '../../../../../lib/telegram';
import { alertDeveloper } from '../../../engine/worker-alerts';
import { recordWorkerEvent, type WorkerEventOrder } from '../../../engine/worker-events.service';
import { MAX_SEND_ATTEMPTS, UNKNOWN_SUPPLIER_BANNER } from './dispatch.constants';
import { renderOrderCard, type OrderCardData } from './order-card';
import type { Recipient } from './recipients';

export type SendOutcome = 'sent' | 'retry' | 'failed' | 'already';

const SENT_EVENT: Record<DispatchKind, WorkerEventType> = {
  NEW: WORKER_EVENT_TYPES.DISPATCH_SENT,
  CANCEL: WORKER_EVENT_TYPES.DISPATCH_CANCEL_SENT,
  RETURN: WORKER_EVENT_TYPES.DISPATCH_RETURN_SENT,
};

/** Подпись у отмены и возврата заказа, который раньше ушёл разработчику: причина уже не известна. */
const DEVELOPER_FOLLOW_UP_CAPTION = 'Заказ раньше ушёл разработчику: поставщик не был определён. Перешлите тому, кто его собирает';

/**
 * Одна карточка одному получателю — с защитой от дублей и повторами.
 *
 * Строка `OrderDispatch` с уникальностью «позиция + вид» заводится до отправки:
 * уже есть и не «ждёт» — значит, ушло или решено не слать, второй раз не шлём.
 * Сбой — попытка засчитывается, повтор в следующем цикле; кончились попытки —
 * «не удалось» и оповещение разработчику.
 *
 * Получатель — разработчик (поставщик не определён): на карточке плашка
 * «ПОСТАВЩИК НЕ ОПРЕДЕЛЁН», в подписи причина. Строка отправки после этого
 * «отправлено» — поставщику позже не уйдёт, переслать должен разработчик.
 */
export async function sendDispatch(input: {
  kind: DispatchKind;
  orderId: string;
  entryId: string;
  recipient: Recipient;
  card: OrderCardData;
  /** Для журнала: «Позиция «Диван Мелодия»». */
  label: string;
  eventOrder: WorkerEventOrder;
  settings: WorkerSettings;
  /** Почему разработчику, а не поставщику — у новых заказов. */
  fallbackReason?: string | null;
}): Promise<SendOutcome> {
  const { kind, recipient } = input;
  const toDeveloper = recipient.kind === 'DEVELOPER';
  const fallbackReason = input.fallbackReason ?? null;
  const card: OrderCardData = toDeveloper ? { ...input.card, warning: UNKNOWN_SUPPLIER_BANNER } : input.card;
  const caption = toDeveloper
    ? `${UNKNOWN_SUPPLIER_BANNER}. ${fallbackReason ?? DEVELOPER_FOLLOW_UP_CAPTION}`
    : undefined;
  const sentEvent = toDeveloper && kind === 'NEW' ? WORKER_EVENT_TYPES.DISPATCH_SENT_TO_DEVELOPER : SENT_EVENT[kind];
  const target = {
    recipient: recipient.kind,
    supplierId: recipient.supplierId,
    warehouseId: recipient.warehouseId,
    recipientName: recipient.name,
    chatId: recipient.chatId,
  };

  const existing = await prisma.orderDispatch.findUnique({
    where: { entryId_kind: { entryId: input.entryId, kind } },
  });

  if (existing && existing.status !== 'PENDING') return 'already';

  // Повтор берёт актуального получателя: поправили Telegram ID после сбоя —
  // следующая попытка уйдёт уже по новому адресу.
  const row = existing
    ? await prisma.orderDispatch.update({ where: { id: existing.id }, data: target })
    : await prisma.orderDispatch.create({
      data: { orderId: input.orderId, entryId: input.entryId, kind, status: 'PENDING', ...target },
    });

  try {
    const png = await renderOrderCard(card);
    const messageId = await sendTelegramPhoto(recipient.chatId, png, caption);

    await prisma.orderDispatch.update({
      where: { id: row.id },
      data: { status: 'SENT', sentAt: new Date(), telegramMessageId: messageId,
        attempts: row.attempts + 1, lastError: null },
    });
    await recordWorkerEvent(WORKER_KEYS.ORDERS, {
      type: sentEvent,
      message: `${input.label} → ${recipient.name}${fallbackReason ? ` (${fallbackReason})` : ''}`,
      details: { kind, recipient: recipient.name, chatId: recipient.chatId, messageId, fallbackReason },
      order: input.eventOrder,
    });

    return 'sent';
  } catch (error) {
    const attempts = row.attempts + 1;
    const message = error instanceof Error ? error.message : 'неизвестная ошибка';
    const gaveUp = attempts >= MAX_SEND_ATTEMPTS;

    await prisma.orderDispatch.update({
      where: { id: row.id },
      data: { attempts, lastError: message, ...(gaveUp ? { status: 'FAILED' as const } : {}) },
    });
    await recordWorkerEvent(WORKER_KEYS.ORDERS, {
      type: gaveUp ? WORKER_EVENT_TYPES.DISPATCH_FAILED : WORKER_EVENT_TYPES.DISPATCH_RETRY,
      message: `${input.label} → ${recipient.name}: ${message} (попытка ${attempts} из ${MAX_SEND_ATTEMPTS})`,
      details: { kind, recipient: recipient.name, chatId: recipient.chatId, attempts, error: message },
      order: input.eventOrder,
    });

    if (gaveUp) {
      await alertDeveloper(WORKER_KEYS.ORDERS, input.settings,
        `Заказ ${input.eventOrder.code}: ${input.label} не ушёл «${recipient.name}» за ${attempts} попыток. ${message}`);
    }

    return gaveUp ? 'failed' : 'retry';
  }
}
