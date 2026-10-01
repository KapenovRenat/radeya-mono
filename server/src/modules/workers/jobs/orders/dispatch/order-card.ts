import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';

import { CARD_FONT_FAMILY, loadCardFonts } from './card-fonts';
import { loadImageDataUri } from './card-image';

/**
 * Карточка заказа — PNG для Telegram. Образцы пользователя — docs/workers.md,
 * «Карточки поставщику».
 *
 * Рисует Satori (разметка → SVG) и resvg (SVG → PNG) — то, что старая админка
 * брала из `next/og`, только без Next. Ограничения Satori (telegram-bot.md, §3):
 * только flex, каждый блок с текстом — свой div, шрифт `.woff`.
 *
 * Эмодзи со старых карточек (🚨, ✅) не рисуются: для них Satori нужен отдельный
 * набор картинок. Их место заняли цвет и плашки.
 */

const WIDTH = 600;
const HEIGHT = 800;
const IMAGE_HEIGHT = 340;

const COLORS = {
  preOrderBg: '#2a1316',
  inStockBg: '#10261a',
  followUpBg: '#14161c',
  banner: '#b3261e',
  white: '#ffffff',
  muted: '#9aa0a6',
  accent: '#ff6b6b',
  product: '#5fd38d',
  action: '#ffd166',
  imageBg: '#f2f2f2',
} as const;

export type OrderCardKind = 'NEW' | 'CANCEL_BY_CUSTOMER' | 'CANCEL_IN_TRANSIT' | 'RETURN';

export interface OrderCardData {
  kind: OrderCardKind;
  orderCode: string;
  salesPointName: string;
  isPreOrder: boolean;
  /** «Отгрузка на Zammler в г. Астана», «Своя доставка», «Самовывоз». */
  shipment: string;
  /** «27 сентября» — только у Kaspi Доставки. */
  handoverDate: string | null;
  productName: string;
  fabric: string | null;
  sku: string | null;
  quantity: number;
  imageUrl: string | null;
  /** Что сделать получателю — у отмены и возврата: «Складировать», «Принять возврат». */
  action: string | null;
  /** Тестовая карточка: сверху плашка «ТЕСТ — НЕ ЗАКАЗ», чтобы её не начали собирать. */
  isTest?: boolean;
}

const BANNERS: Record<Exclude<OrderCardKind, 'NEW'>, { banner: string; type: string }> = {
  CANCEL_BY_CUSTOMER: { banner: 'ОТМЕНА ЗАКАЗА', type: 'Отмена клиентом' },
  CANCEL_IN_TRANSIT: { banner: 'ОТМЕНА ЗАКАЗА', type: 'Отмена в пути' },
  RETURN: { banner: 'ВОЗВРАТ ЗАКАЗА', type: 'Возврат' },
};

export async function renderOrderCard(card: OrderCardData): Promise<Uint8Array> {
  const fonts = await loadCardFonts();
  const image = await loadImageDataUri(card.imageUrl);

  // Satori типизирован под React; здесь разметка — простые объекты той же формы.
  const svg = await satori(buildCard(card, image) as never, { width: WIDTH, height: HEIGHT, fonts });

  return new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();
}

/** Узел разметки Satori — то, во что компилируется JSX, без React. */
interface CardNode {
  type: string;
  props: Record<string, unknown>;
}

type Style = Record<string, string | number>;

function box(style: Style, ...children: (CardNode | null)[]): CardNode {
  return { type: 'div', props: { style: { display: 'flex', ...style }, children: children.filter(Boolean) } };
}

function text(value: string, style: Style): CardNode {
  return { type: 'div', props: { style: { display: 'flex', ...style }, children: value } };
}

function buildCard(card: OrderCardData, image: string | null): CardNode {
  const followUp = card.kind === 'NEW' ? null : BANNERS[card.kind];
  const background = followUp
    ? COLORS.followUpBg
    : card.isPreOrder ? COLORS.preOrderBg : COLORS.inStockBg;
  const shortNumber = card.orderCode.slice(-4);
  const quantity = card.quantity > 1 ? ` × ${card.quantity}` : '';
  // Тестовая плашка съедает высоту — её отдаёт фото, а не текст заказа.
  const imageHeight = IMAGE_HEIGHT - (card.isTest ? 48 : 0);

  return box(
    { width: WIDTH, height: HEIGHT, flexDirection: 'column', backgroundColor: background, fontFamily: CARD_FONT_FAMILY },

    card.isTest ? box(
      { height: 48, backgroundColor: COLORS.action, alignItems: 'center', justifyContent: 'center' },
      text('ТЕСТ — НЕ ЗАКАЗ', { color: '#000000', fontSize: 28, fontWeight: 900 }),
    ) : null,

    followUp && box(
      { height: 64, backgroundColor: COLORS.banner, alignItems: 'center', justifyContent: 'center' },
      text(followUp.banner, { color: COLORS.white, fontSize: 32, fontWeight: 900 }),
    ),

    box(
      { height: imageHeight, backgroundColor: COLORS.imageBg, alignItems: 'center', justifyContent: 'center' },
      image
        ? { type: 'img', props: { src: image, width: WIDTH, height: imageHeight,
          style: { objectFit: 'contain', width: WIDTH, height: imageHeight } } }
        : text('Нет фото товара', { color: COLORS.muted, fontSize: 26 }),
    ),

    box(
      { flexDirection: 'column', padding: '24px 32px', gap: 14, flexGrow: 1 },

      box(
        { alignItems: 'flex-end', gap: 12 },
        text('ЗАКАЗ', { color: COLORS.white, fontSize: 26 }),
        text(`#${shortNumber}`, { color: COLORS.white, fontSize: 40, fontWeight: 700 }),
        text(`(${card.orderCode})`, { color: COLORS.muted, fontSize: 22 }),
      ),

      followUp
        ? text(`Тип: ${followUp.type}`, { color: COLORS.accent, fontSize: 24, fontWeight: 700 })
        : text(card.salesPointName, { color: COLORS.accent, fontSize: 24, fontWeight: 700 }),

      followUp ? null : text(card.shipment, { color: COLORS.white, fontSize: 28, fontWeight: 900 }),
      followUp || card.handoverDate === null
        ? null
        : text(`Дата сдачи: ${card.handoverDate}`, { color: COLORS.white, fontSize: 24, fontWeight: 700 }),

      text(card.productName + quantity, { color: COLORS.product, fontSize: 26, fontWeight: 700 }),
      card.fabric === null ? null : text(`Основная ткань: ${card.fabric}`, { color: COLORS.muted, fontSize: 22 }),
      text(`Артикул изделия: ${card.sku ?? '—'}`, { color: COLORS.white, fontSize: 30, fontWeight: 700 }),

      card.action === null
        ? null
        : text(`→ ${card.action}`, { color: COLORS.action, fontSize: 30, fontWeight: 900 }),
    ),
  );
}
