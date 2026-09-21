-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('SITE', 'KASPI', 'OFFLINE');

-- CreateEnum
CREATE TYPE "OrderDeliveryType" AS ENUM ('KASPI', 'PICKUP', 'OWN');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'SIGN_REQUIRED', 'PRE_ORDER', 'PACKING', 'TRANSMISSION', 'TRANSMITTED', 'PICKUP', 'OWN_DELIVERY', 'DELIVERED', 'CANCELLING', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED');

-- AlterTable
ALTER TABLE "Warehouse" ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "pickupType" TEXT;

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "source" "OrderSource" NOT NULL DEFAULT 'KASPI',
    "kaspiId" TEXT,
    "code" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "deliveryType" "OrderDeliveryType" NOT NULL,
    "kaspiStatus" TEXT NOT NULL,
    "kaspiState" TEXT,
    "cancellationReason" TEXT,
    "cancelReason" TEXT,
    "cancelSubReason" TEXT,
    "moderated" BOOLEAN,
    "moderatedReason" TEXT,
    "moderatedSubReason" TEXT,
    "createdAtKaspi" TIMESTAMP(3) NOT NULL,
    "updatedAtKaspi" TIMESTAMP(3),
    "approvedByBankAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "assembledAt" TIMESTAMP(3),
    "courierTransmissionAt" TIMESTAMP(3),
    "courierTransmissionPlannedAt" TIMESTAMP(3),
    "plannedDeliveryAt" TIMESTAMP(3),
    "actualDeliveryAt" TIMESTAMP(3),
    "returnedToWarehouseAt" TIMESTAMP(3),
    "returnedToWarehouseTimeoutAt" TIMESTAMP(3),
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "deliveryCost" DECIMAL(12,2),
    "deliveryCostForSeller" DECIMAL(12,2),
    "loanAmount" DECIMAL(12,2),
    "paymentMode" TEXT,
    "creditTerm" INTEGER,
    "signatureRequired" BOOLEAN NOT NULL DEFAULT false,
    "preOrder" BOOLEAN NOT NULL DEFAULT false,
    "assembled" BOOLEAN NOT NULL DEFAULT false,
    "isKaspiDelivery" BOOLEAN NOT NULL DEFAULT false,
    "isExpress" BOOLEAN NOT NULL DEFAULT false,
    "isOrderArrived" BOOLEAN,
    "returnedToWarehouse" BOOLEAN NOT NULL DEFAULT false,
    "deliveryMode" TEXT,
    "deliveryMethod" TEXT,
    "deliveryZone" TEXT,
    "cargoSpace" INTEGER,
    "waybillNumber" TEXT,
    "firstMileCourier" TEXT,
    "kaspiCustomerId" TEXT,
    "customerName" TEXT,
    "customerFirstName" TEXT,
    "customerLastName" TEXT,
    "customerPhone" TEXT,
    "deliveryCityId" TEXT,
    "deliveryTown" TEXT,
    "deliveryDistrict" TEXT,
    "deliveryStreetName" TEXT,
    "deliveryStreetNumber" TEXT,
    "deliveryBuilding" TEXT,
    "deliveryApartment" TEXT,
    "deliveryFloor" TEXT,
    "deliveryEntrance" TEXT,
    "deliveryIntercom" TEXT,
    "deliveryComment" TEXT,
    "deliveryIsPrivateHouse" BOOLEAN,
    "deliveryFormattedAddress" TEXT,
    "deliveryLatitude" DOUBLE PRECISION,
    "deliveryLongitude" DOUBLE PRECISION,
    "warehouseId" UUID,
    "kaspiPickupPointId" TEXT,
    "originCityId" TEXT,
    "originCityName" TEXT,
    "originFormattedAddress" TEXT,
    "raw" JSONB,
    "rawCabinet" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEntry" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "entryNumber" INTEGER NOT NULL,
    "kaspiEntryId" TEXT,
    "sku" TEXT,
    "variantId" UUID,
    "offerName" TEXT,
    "kaspiProductCode" TEXT,
    "kaspiProductName" TEXT,
    "barcode" TEXT,
    "isImeiRequired" BOOLEAN,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "basePrice" DECIMAL(12,2),
    "totalPrice" DECIMAL(12,2),
    "deliveryCost" DECIMAL(12,2),
    "categoryCode" TEXT,
    "categoryTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderMarker" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "marker" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "userName" TEXT,

    CONSTRAINT "OrderMarker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStep" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "step" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "plannedAt" TIMESTAMP(3),
    "timeoutAt" TIMESTAMP(3),
    "additionalDays" INTEGER,

    CONSTRAINT "OrderStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_kaspiId_key" ON "Order"("kaspiId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_code_key" ON "Order"("code");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_createdAtKaspi_idx" ON "Order"("createdAtKaspi");

-- CreateIndex
CREATE INDEX "Order_warehouseId_idx" ON "Order"("warehouseId");

-- CreateIndex
CREATE INDEX "Order_kaspiPickupPointId_idx" ON "Order"("kaspiPickupPointId");

-- CreateIndex
CREATE INDEX "OrderEntry_sku_idx" ON "OrderEntry"("sku");

-- CreateIndex
CREATE INDEX "OrderEntry_variantId_idx" ON "OrderEntry"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderEntry_orderId_entryNumber_key" ON "OrderEntry"("orderId", "entryNumber");

-- CreateIndex
CREATE INDEX "OrderMarker_orderId_idx" ON "OrderMarker"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderMarker_orderId_marker_at_key" ON "OrderMarker"("orderId", "marker", "at");

-- CreateIndex
CREATE INDEX "OrderStep_orderId_idx" ON "OrderStep"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderStep_orderId_step_key" ON "OrderStep"("orderId", "step");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEntry" ADD CONSTRAINT "OrderEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEntry" ADD CONSTRAINT "OrderEntry_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderMarker" ADD CONSTRAINT "OrderMarker_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStep" ADD CONSTRAINT "OrderStep_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
