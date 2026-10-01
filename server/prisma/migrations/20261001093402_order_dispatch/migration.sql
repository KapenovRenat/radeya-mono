-- CreateEnum
CREATE TYPE "DispatchKind" AS ENUM ('NEW', 'CANCEL', 'RETURN');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('PENDING', 'SENT', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "DispatchRecipient" AS ENUM ('SUPPLIER', 'WAREHOUSE');

-- AlterTable
ALTER TABLE "Warehouse" ADD COLUMN     "telegramChatId" TEXT;

-- CreateTable
CREATE TABLE "OrderDispatch" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "kind" "DispatchKind" NOT NULL,
    "status" "DispatchStatus" NOT NULL DEFAULT 'PENDING',
    "recipient" "DispatchRecipient",
    "supplierId" UUID,
    "warehouseId" UUID,
    "recipientName" TEXT,
    "chatId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "telegramMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderDispatch_orderId_idx" ON "OrderDispatch"("orderId");

-- CreateIndex
CREATE INDEX "OrderDispatch_kind_status_idx" ON "OrderDispatch"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrderDispatch_entryId_kind_key" ON "OrderDispatch"("entryId", "kind");

-- AddForeignKey
ALTER TABLE "OrderDispatch" ADD CONSTRAINT "OrderDispatch_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDispatch" ADD CONSTRAINT "OrderDispatch_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "OrderEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDispatch" ADD CONSTRAINT "OrderDispatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDispatch" ADD CONSTRAINT "OrderDispatch_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
