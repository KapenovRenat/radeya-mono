import {
  ASTANA_STOCK_WAREHOUSE_CODE,
  variantDisplayName,
  type SendTestCardRequest,
  type SendTestCardResponse,
  type TestCardKind,
  type TestCardResult,
} from '@radeya/shared';

import { prisma } from '../../../../../db/client';
import { Prisma } from '../../../../../generated/prisma/client';
import { formatAstanaDay } from '../../../../../lib/astana-time';
import { AppError } from '../../../../../lib/errors';
import { sendTelegramPhoto } from '../../../../../lib/telegram';
import { largeImageUrl } from '../../../../products/catalog.mapper';
import { ASTANA_GROUP_NAME, KASPI_LOGISTICS_NAME, SEND_PAUSE_MS } from './dispatch.constants';
import { renderOrderCard, type OrderCardData } from './order-card';

/**
 * Тестовая карточка: выдуманный заказ с настоящим диваном из каталога.
 *
 * Проверяет всю цепочку отправки — токен бота, шрифты, фото с CDN Kaspi,
 * доступ бота к каждому чату — и вид карточки, не дожидаясь живого заказа.
 * Ни заказов, ни отправок (`OrderDispatch`) не трогает. На карточке плашка
 * «ТЕСТ — НЕ ЗАКАЗ»: при отправке всем её получат и поставщики.
 */

/** Номер выдуманного заказа — видно, что тест: настоящие номера Kaspi на 10 не начинаются. */
const TEST_ORDER_CODE = '1000001234';

/** Что искать в каталоге: диван с фото — так видно и картинку, и длинное название. */
const TEST_PRODUCT_WORD = 'диван';

const ACTIONS: Record<TestCardKind, string | null> = {
  NEW: null,
  CANCEL_BY_CUSTOMER: 'Складировать',
  CANCEL_IN_TRANSIT: `Забрать с ${KASPI_LOGISTICS_NAME} в г. Астана`,
  RETURN: 'Принять возврат',
};

interface TestRecipient {
  name: string;
  chatId: string;
}

export async function sendTestCard(input: SendTestCardRequest): Promise<SendTestCardResponse> {
  const recipients = await collectRecipients(input);

  if (recipients.length === 0) {
    throw new AppError(400, 'TEST_NO_RECIPIENTS', 'Некому отправить: ни у кого нет Telegram ID');
  }

  const variant = await findTestVariant();

  if (variant === null) {
    throw new AppError(404, 'TEST_PRODUCT_NOT_FOUND', 'В каталоге нет ни одного товара для тестовой карточки');
  }

  const imageUrl = largeImageUrl(variant.kaspiImages);
  const productName = variantDisplayName(variant.kaspiMasterTitle, variant.product.name);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60_000);

  const card: OrderCardData = {
    kind: input.kind,
    orderCode: TEST_ORDER_CODE,
    salesPointName: 'Kaspi магазин',
    isPreOrder: true,
    shipment: `Отгрузка на ${KASPI_LOGISTICS_NAME} в г. Астана`,
    handoverDate: formatAstanaDay(tomorrow),
    productName,
    fabric: variant.fabric?.name ?? null,
    sku: variant.sku,
    quantity: 1,
    imageUrl,
    action: ACTIONS[input.kind],
    isTest: true,
  };

  // Одна картинка на всех: рисуется раз, уходит каждому. Шрифты или рендер
  // сломались — ошибка сразу, а не двадцать одинаковых по получателям.
  const png = await renderOrderCard(card);
  const results: TestCardResult[] = [];

  for (const [index, recipient] of recipients.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, SEND_PAUSE_MS));

    try {
      await sendTelegramPhoto(recipient.chatId, png);
      results.push({ recipient: recipient.name, chatId: recipient.chatId, ok: true, error: null });
    } catch (error) {
      results.push({
        recipient: recipient.name,
        chatId: recipient.chatId,
        ok: false,
        error: error instanceof Error ? error.message : 'неизвестная ошибка',
      });
    }
  }

  return { sku: variant.sku, productName, hasImage: imageUrl !== null, results };
}

/**
 * Кому слать. `ALL` — все, кому воркер вообще может что-то отправить:
 * группа Астаны и активные поставщики с Telegram ID, плюс указанный ID.
 * Один и тот же чат дважды не получит.
 */
async function collectRecipients(input: SendTestCardRequest): Promise<TestRecipient[]> {
  const list: TestRecipient[] = [];

  if (input.chatId) list.push({ name: 'Указанный ID', chatId: input.chatId });

  if (input.target === 'ALL') {
    const astana = await prisma.warehouse.findUnique({
      where: { code: ASTANA_STOCK_WAREHOUSE_CODE },
      select: { telegramChatId: true },
    });

    if (astana?.telegramChatId) list.push({ name: ASTANA_GROUP_NAME, chatId: astana.telegramChatId });

    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true, telegramId: { not: null } },
      select: { name: true, telegramId: true },
      orderBy: { name: 'asc' },
    });

    for (const supplier of suppliers) {
      if (supplier.telegramId) list.push({ name: supplier.name, chatId: supplier.telegramId });
    }
  }

  const seen = new Set<string>();

  return list.filter((recipient) => {
    if (seen.has(recipient.chatId)) return false;
    seen.add(recipient.chatId);

    return true;
  });
}

/** Диван с фото, если есть; иначе любой товар с фото; иначе любой. */
async function findTestVariant() {
  const select = {
    sku: true, kaspiMasterTitle: true, kaspiImages: true,
    product: { select: { name: true } },
    fabric: { select: { name: true } },
  } as const;
  // Json-поле в Prisma сравнивается с пустотой через DbNull, а не через null.
  const withImages = { kaspiImages: { not: Prisma.DbNull } };

  return await prisma.variant.findFirst({
    where: {
      ...withImages,
      OR: [
        { kaspiMasterTitle: { contains: TEST_PRODUCT_WORD, mode: 'insensitive' } },
        { product: { name: { contains: TEST_PRODUCT_WORD, mode: 'insensitive' } } },
      ],
    },
    select,
    orderBy: { updatedAt: 'desc' },
  })
    ?? await prisma.variant.findFirst({ where: withImages, select, orderBy: { updatedAt: 'desc' } })
    ?? await prisma.variant.findFirst({ select, orderBy: { updatedAt: 'desc' } });
}
