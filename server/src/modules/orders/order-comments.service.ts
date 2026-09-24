import type { AuthUser, OrderCommentDto, OrderCommentsResponse } from '@radeya/shared';

import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../db/client';
import { NotFoundError } from '../../lib/errors';

/**
 * Комментарии к заказу.
 *
 * Лента только пополняется: правки и удаления нет ни здесь, ни в API.
 * Комментарий, который можно подтереть, не отвечает на вопрос «кто это решил»,
 * а ради него всё и заводилось.
 */

const commentSelect = {
  id: true,
  orderId: true,
  authorId: true,
  authorRole: true,
  text: true,
  createdAt: true,
  // Имя читается по связи, а не снимком: переименовали сотрудника — поправилось
  // во всех его комментариях. Роль, наоборот, лежит снимком в своей колонке.
  author: { select: { name: true } },
} as const;

type CommentRow = Prisma.OrderCommentGetPayload<{ select: typeof commentSelect }>;

function toDto(row: CommentRow): OrderCommentDto {
  return {
    id: row.id,
    orderId: row.orderId,
    authorId: row.authorId,
    authorName: row.author.name,
    authorRole: row.authorRole,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Старые сверху: комментарии читают как переписку, с начала. */
export async function listOrderComments(orderId: string): Promise<OrderCommentsResponse> {
  const rows = await prisma.orderComment.findMany({
    where: { orderId },
    select: commentSelect,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  return { items: rows.map(toDto) };
}

/**
 * Новый комментарий.
 *
 * Автор берётся из сессии, а не из тела запроса: иначе подписаться можно было бы
 * кем угодно. Роль пишется снимком на момент записи — она часть смысла.
 */
export async function addOrderComment(
  orderId: string,
  text: string,
  author: AuthUser,
): Promise<OrderCommentDto> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });

  if (!order) throw new NotFoundError('Заказ не найден');

  const row = await prisma.orderComment.create({
    data: { orderId, authorId: author.id, authorRole: author.role, text },
    select: commentSelect,
  });

  return toDto(row);
}
