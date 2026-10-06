-- CreateEnum
CREATE TYPE "StockDocumentType" AS ENUM ('ENTER', 'WRITE_OFF');

-- AlterTable
ALTER TABLE "VariantStock" ADD COLUMN     "preOrderQuantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Warehouse" ALTER COLUMN "kaspiStoreId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "StockDocument" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "type" "StockDocumentType" NOT NULL,
    "warehouseId" UUID NOT NULL,
    "comment" TEXT,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "postedAt" TIMESTAMP(3),
    "postedById" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockDocumentLine" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "StockDocumentLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockDocument_number_key" ON "StockDocument"("number");

-- CreateIndex
CREATE INDEX "StockDocument_createdAt_idx" ON "StockDocument"("createdAt");

-- CreateIndex
CREATE INDEX "StockDocument_type_createdAt_idx" ON "StockDocument"("type", "createdAt");

-- CreateIndex
CREATE INDEX "StockDocument_warehouseId_idx" ON "StockDocument"("warehouseId");

-- CreateIndex
CREATE INDEX "StockDocumentLine_variantId_idx" ON "StockDocumentLine"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "StockDocumentLine_documentId_variantId_key" ON "StockDocumentLine"("documentId", "variantId");

-- AddForeignKey
ALTER TABLE "StockDocument" ADD CONSTRAINT "StockDocument_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockDocument" ADD CONSTRAINT "StockDocument_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockDocument" ADD CONSTRAINT "StockDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockDocumentLine" ADD CONSTRAINT "StockDocumentLine_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "StockDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockDocumentLine" ADD CONSTRAINT "StockDocumentLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
