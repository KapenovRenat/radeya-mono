import type { RequestHandler } from 'express';
import { AUDIT_ACTIONS, type KaspiOrderDraft, type KaspiOrdersPreview,
  type ValueCounts } from '@radeya/shared';

import { env } from '../../config/env';
import { clientIp, logAction } from '../../lib/audit';
import { AppError, ValidationError } from '../../lib/errors';
import { isKnownState, isKnownStatus } from './kaspi-order-status';
import { fetchKaspiOrders } from './kaspi-orders.client';
import { toOrderDraft } from './kaspi-orders.mapper';
import { addOrderComment, listOrderComments } from './order-comments.service';
import { createOrderCommentSchema, kaspiOrdersQuerySchema, orderListSchema,
  orderParamsSchema, syncOrdersSchema } from './orders.schemas';
import { listOrders, syncKaspiOrders } from './orders.service';

/** Страница заказов из нашей базы: поиск по номеру, свежие сверху. */
export const getOrders: RequestHandler = async (req, res) => {
  const parsed = orderListSchema.safeParse(req.query);

  if (!parsed.success) throw new ValidationError('Проверьте параметры списка');

  res.json(await listOrders(parsed.data));
};

/** Лента комментариев заказа, старые сверху. */
export const getOrderComments: RequestHandler = async (req, res) => {
  const params = orderParamsSchema.safeParse(req.params);

  if (!params.success) throw new ValidationError('Некорректный заказ');

  res.json(await listOrderComments(params.data.id));
};

/**
 * Новый комментарий.
 *
 * В журнал действий не пишем: комментарий сам себе запись — в нём уже есть
 * автор, роль и время, а удалить его нельзя. Дублировать это в аудит значит
 * хранить одно и то же дважды.
 */
export const postOrderComment: RequestHandler = async (req, res) => {
  const params = orderParamsSchema.safeParse(req.params);
  const body = createOrderCommentSchema.safeParse(req.body);

  if (!params.success || !body.success) throw new ValidationError('Проверьте заказ и текст');

  const comment = await addOrderComment(params.data.id, body.data.text, req.user!);

  res.status(201).json(comment);
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Одна страница заказов Kaspi, разобранная в нашу модель. **В базу не пишет** —
 * это просмотр: рядом с разобранным едет первый заказ сырым, чтобы сверять
 * маппинг глазами, не открывая Kaspi отдельно.
 */
export const getKaspiOrders: RequestHandler = async (req, res) => {
  const parsed = kaspiOrdersQuerySchema.safeParse(req.query);

  if (!parsed.success) throw new ValidationError('Проверьте days, page и pageSize');

  const token = env.KASPI_API_TOKEN;

  if (!token) {
    throw new AppError(
      503,
      'KASPI_TOKEN_MISSING',
      'Не задан KASPI_API_TOKEN в .env — запрос к Kaspi невозможен',
    );
  }

  const to = Date.now();
  const from = to - parsed.data.days * DAY_MS;

  const page = await fetchKaspiOrders({
    token, from, to, page: parsed.data.page, pageSize: parsed.data.pageSize,
  });

  const orders: KaspiOrderDraft[] = [];

  for (const raw of page.orders) {
    const draft = toOrderDraft(raw);

    // Заказ без номера пропускаем: сопоставить его не с чем, и в базе
    // он был бы записью, которую никак не найти.
    if (draft !== null) orders.push(draft);
  }

  const preview: KaspiOrdersPreview = {
    meta: page.meta,
    count: orders.length,
    orders,
    sample: page.orders.length > 0 && orders[0] !== undefined
      ? { raw: page.orders[0], mapped: orders[0] }
      : null,
    withProblems: orders.filter((order) => order.problems.length > 0).length,
    ...(parsed.data.raw === 1 ? { rawOrders: page.orders } : {}),
    seen: {
      kaspiStatuses: count(orders, (order) => order.kaspiStatus),
      kaspiStates: count(orders, (order) => order.kaspiState),
      deliveryModes: count(orders, (order) => order.deliveryMode),
      statuses: count(orders, (order) => order.status),
      deliveryTypes: count(orders, (order) => order.deliveryType),
    },
    unknownValues: collectUnknown(orders),
  };

  res.json(preview);
};

/**
 * Шаг синхронизации: читает заказы из Kaspi и пишет их в базу.
 *
 * Возобновляемый: за вызов обрабатывается пачка трёхдневных отрезков, дальше
 * возвращается курсор. Клиент повторяет вызов, пока не придёт `done`.
 */
export const postSyncKaspiOrders: RequestHandler = async (req, res) => {
  const parsed = syncOrdersSchema.safeParse(req.body);

  if (!parsed.success) throw new ValidationError('Проверьте период, курсор и maxChunks');

  const result = await syncKaspiOrders(parsed.data);
  const author = req.user!;

  // В журнал — только счётчики: сами заказы это персональные данные покупателей,
  // а журнал не хранилище. Запись на каждый шаг: их у полного прогона около
  // десятка, и по ним видно, где синхронизация оборвалась.
  await logAction({
    userId: author.id, userLogin: author.login, userRole: author.role,
    action: AUDIT_ACTIONS.KASPI_ORDERS_SYNCED, entityType: 'Order',
    after: {
      period: result.period, from: result.from, to: result.to,
      done: result.done, chunksDone: result.chunksDone, chunksTotal: result.chunksTotal,
      created: result.created, updated: result.updated, skipped: result.skipped,
      withProblems: result.withProblems, tookMs: result.tookMs,
      unknownValues: result.unknownValues, unknownWarehouses: result.unknownWarehouses,
    },
    ip: clientIp(req),
  });

  res.json(result);
};

/** Сколько раз встретилось каждое значение. Пустые не считаем. */
function count(orders: KaspiOrderDraft[], read: (order: KaspiOrderDraft) => string | null): ValueCounts {
  const counts: ValueCounts = {};

  for (const order of orders) {
    const value = read(order);

    if (value === null || value === '') continue;
    counts[value] = (counts[value] ?? 0) + 1;
  }

  return counts;
}

/**
 * Значения Kaspi, которых нет в нашем списке известных.
 *
 * Полного перечня статусов площадка не публикует, поэтому список знакомых
 * значений заведомо неполон. Это единственный способ узнать о новом статусе
 * до того, как он тихо станет «Новым» в интерфейсе.
 */
function collectUnknown(orders: KaspiOrderDraft[]): string[] {
  const unknown = new Set<string>();

  for (const order of orders) {
    if (order.kaspiStatus !== '' && !isKnownStatus(order.kaspiStatus)) {
      unknown.add('status: ' + order.kaspiStatus);
    }
    if (order.kaspiState !== null && !isKnownState(order.kaspiState)) {
      unknown.add('state: ' + order.kaspiState);
    }
  }

  return [...unknown].sort();
}
