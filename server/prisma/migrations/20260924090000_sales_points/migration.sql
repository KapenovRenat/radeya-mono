-- Точки продаж, продавец и комментарии на заказе.
--
-- Миграция написана руками, а не сгенерирована: переименование колонки
-- `createdAtKaspi` -> `placedAt` Prisma оформляет как DROP + ADD, то есть
-- потеряла бы дату у всех существующих заказов. Здесь — RENAME, данные на месте.

-- CreateEnum
CREATE TYPE "SalesPointType" AS ENUM ('KASPI', 'OZON', 'SITE', 'OFFLINE');

-- CreateTable
CREATE TABLE "SalesPoint" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SalesPointType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesPoint_code_key" ON "SalesPoint"("code");

-- CreateIndex
CREATE INDEX "SalesPoint_type_idx" ON "SalesPoint"("type");

-- CreateIndex
CREATE INDEX "SalesPoint_isActive_idx" ON "SalesPoint"("isActive");

-- Системные точки. Через API они не создаются: синхронизация ищет Kaspi
-- по коду, и переименование или удаление этой строки сломало бы её.
-- Ozon и сайт заведены закрытыми — каналов ещё нет, но кода под них уже нет
-- и не понадобится: открываются флагом, а не миграцией.
INSERT INTO "SalesPoint" ("id", "code", "name", "type", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'KASPI', 'Kaspi',        'KASPI', true,  0,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'OZON',  'Ozon',         'OZON',  false, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SITE',  'Сайт-магазин', 'SITE',  false, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- RenameColumn: дата оформления заказа перестала быть «датой у Kaspi»,
-- потому что офлайн-заказ Kaspi не создавал, а считать период надо по одной
-- дате для всех источников.
ALTER TABLE "Order" RENAME COLUMN "createdAtKaspi" TO "placedAt";
ALTER INDEX "Order_createdAtKaspi_idx" RENAME TO "Order_placedAt_idx";

-- DropColumn: `source` ни разу не читался кодом, а на его вопрос теперь
-- отвечает `salesPoint.type`. Два источника правды разошлись бы.
ALTER TABLE "Order" DROP COLUMN "source";
DROP TYPE "OrderSource";

-- AddColumn
ALTER TABLE "Order" ADD COLUMN "salesPointId" UUID;
ALTER TABLE "Order" ADD COLUMN "sellerId" UUID;

-- Всё, что уже лежит в таблице, приехало синхронизацией из Kaspi.
UPDATE "Order"
SET "salesPointId" = (SELECT "id" FROM "SalesPoint" WHERE "code" = 'KASPI')
WHERE "salesPointId" IS NULL;

ALTER TABLE "Order" ALTER COLUMN "salesPointId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_salesPointId_fkey" FOREIGN KEY ("salesPointId") REFERENCES "SalesPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Order_salesPointId_placedAt_idx" ON "Order"("salesPointId", "placedAt");

-- CreateIndex
CREATE INDEX "Order_sellerId_placedAt_idx" ON "Order"("sellerId", "placedAt");

-- CreateTable
CREATE TABLE "OrderComment" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "authorRole" "UserRole" NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderComment_orderId_createdAt_idx" ON "OrderComment"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderComment_authorId_idx" ON "OrderComment"("authorId");

-- AddForeignKey
ALTER TABLE "OrderComment" ADD CONSTRAINT "OrderComment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderComment" ADD CONSTRAINT "OrderComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
