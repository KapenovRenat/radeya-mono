-- Офлайн-заказы: пополняемые справочники, деньги клиента, скидка, привязка
-- к заказу площадки.
--
-- Миграция написана руками: Prisma не умеет снимать NOT NULL с колонки
-- в паре с добавлением связей так, чтобы это читалось, а списки нужно
-- засидить реальными значениями из таблицы продаж — иначе первый же импорт
-- отклонит все строки как «значение не из справочника».

-- CreateEnum
CREATE TYPE "DictionaryKind" AS ENUM ('CUSTOMER_SOURCE', 'DELIVERY_STATUS', 'SHIPMENT_ORIGIN', 'PAYMENT_METHOD');

-- CreateTable
CREATE TABLE "DictionaryItem" (
    "id" UUID NOT NULL,
    "kind" "DictionaryKind" NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DictionaryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DictionaryItem_kind_name_key" ON "DictionaryItem"("kind", "name");

-- CreateIndex
CREATE INDEX "DictionaryItem_kind_sortOrder_idx" ON "DictionaryItem"("kind", "sortOrder");

-- Значения взяты из рабочей таблицы продаж как есть, вместе с квадратными
-- скобками и заглавными буквами: импорт сопоставляет строки файла по названию,
-- и любое «причёсывание» здесь превратилось бы в непопадание при разборе.
INSERT INTO "DictionaryItem" ("id", "kind", "name", "sortOrder", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'CUSTOMER_SOURCE', 'Проходящие',       10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'CUSTOMER_SOURCE', 'Повторная покупка', 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'CUSTOMER_SOURCE', 'Инстаграм',         30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'CUSTOMER_SOURCE', 'Каспи Магазин',     40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'CUSTOMER_SOURCE', 'Флаера (Раздача)',  50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  (gen_random_uuid(), 'DELIVERY_STATUS', 'Ожидает оплату',                      10,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'DELIVERY_STATUS', 'Изготавливается',                     20,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'DELIVERY_STATUS', 'Задерживается',                       30,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'DELIVERY_STATUS', 'Готов, ожидает машину Омск - Астана', 40,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'DELIVERY_STATUS', 'Едет Омск - Астана',                  50,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'DELIVERY_STATUS', 'Едет с Озона',                        60,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'DELIVERY_STATUS', 'На Доставке по Астане',               70,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'DELIVERY_STATUS', 'На доставке Zammler по Казахстану',   80,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'DELIVERY_STATUS', 'Хранится на витрине в Нсити',         90,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'DELIVERY_STATUS', 'Хранится на витрине в Артеме',        100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'DELIVERY_STATUS', 'Хранится на складе Акжол 19/2',       110, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'DELIVERY_STATUS', 'Отправила Анаре Карточку',            120, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'DELIVERY_STATUS', 'Отправила Дамиру карточку',           130, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'DELIVERY_STATUS', 'Доставлен Клиенту',                   140, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'DELIVERY_STATUS', 'Доставлен частично',                  150, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'DELIVERY_STATUS', 'Оформлен возврат',                    160, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'DELIVERY_STATUS', 'Отмена заказа (Причину описать)',     170, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  -- Удалять заказы может только админ, поэтому ошибочная строка не стирается,
  -- а помечается — и выпадает из статистики как не состоявшаяся продажа.
  (gen_random_uuid(), 'DELIVERY_STATUS', 'Ошибочный ввод',                      180, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  (gen_random_uuid(), 'SHIPMENT_ORIGIN', 'Астана [Витрина Ncity]',              10,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SHIPMENT_ORIGIN', 'Астана [Витрина ТЦ Тулпар]',          20,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SHIPMENT_ORIGIN', 'Астана [Витрина ТЦ Артём]',           30,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SHIPMENT_ORIGIN', 'Астана [Склад в ТЦ Артём]',           40,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SHIPMENT_ORIGIN', 'Астана [Склад Акжол 19/2]',           50,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SHIPMENT_ORIGIN', 'Астана [Элла] ул Булана Шолака 11/3', 60,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SHIPMENT_ORIGIN', 'Омск [Алишер] Заказ',                 70,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SHIPMENT_ORIGIN', 'Павлодар [Игорь] Заказ',              80,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SHIPMENT_ORIGIN', 'Павлодар [Руслан] Заказ',             90,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SHIPMENT_ORIGIN', 'Павлодар [Дмитрий] Заказ',            100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SHIPMENT_ORIGIN', 'Костанай [Антон]',                    110, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  (gen_random_uuid(), 'PAYMENT_METHOD', 'Наличка',                                       10,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PAYMENT_METHOD', 'QR Kaspi',                                      20,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PAYMENT_METHOD', 'QR Halyk',                                      30,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PAYMENT_METHOD', 'Каспи 0-0-12',                                  40,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PAYMENT_METHOD', 'Каспи 0-0-24',                                  50,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PAYMENT_METHOD', 'Каспи RED',                                     60,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PAYMENT_METHOD', 'Halyk 0-0-12',                                  70,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PAYMENT_METHOD', 'Halyk 0-0-24',                                  80,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PAYMENT_METHOD', 'Home Credit 0-0-12',                            90,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PAYMENT_METHOD', 'Home Credit 0-0-24',                            100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PAYMENT_METHOD', 'Оплата Картой другого банка (Терминал Каспи)',  110, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PAYMENT_METHOD', 'Оплата Картой другого банка (Терминал Forte)',  120, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PAYMENT_METHOD', 'Перечисление на юр. лицо',                      130, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable: у офлайн-предзаказа доставка ещё не выбрана. У заказов площадки
-- значение по-прежнему проставляется всегда — оно считается из полей Kaspi.
ALTER TABLE "Order" ALTER COLUMN "deliveryType" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "externalNumber" TEXT,
ADD COLUMN "linkedOrderId" UUID,
ADD COLUMN "paidAmount" DECIMAL(12,2),
ADD COLUMN "balanceDue" DECIMAL(12,2),
ADD COLUMN "discountPercent" DECIMAL(5,2),
ADD COLUMN "discountComment" TEXT,
ADD COLUMN "customerSourceId" UUID,
ADD COLUMN "deliveryStatusId" UUID,
ADD COLUMN "shipmentOriginId" UUID,
ADD COLUMN "paymentMethodId" UUID;

-- AlterTable
ALTER TABLE "OrderEntry" ADD COLUMN "note" TEXT;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_linkedOrderId_fkey" FOREIGN KEY ("linkedOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerSourceId_fkey" FOREIGN KEY ("customerSourceId") REFERENCES "DictionaryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryStatusId_fkey" FOREIGN KEY ("deliveryStatusId") REFERENCES "DictionaryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shipmentOriginId_fkey" FOREIGN KEY ("shipmentOriginId") REFERENCES "DictionaryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "DictionaryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Order_linkedOrderId_idx" ON "Order"("linkedOrderId");
