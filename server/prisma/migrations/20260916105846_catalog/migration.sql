-- CreateEnum
CREATE TYPE "SalesChannel" AS ENUM ('SITE', 'KASPI', 'OZON');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ON_SALE', 'OFF_SALE');

-- CreateEnum
CREATE TYPE "ChangeSource" AS ENUM ('KASPI_SYNC', 'MANUAL');

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" UUID,
    "path" TEXT NOT NULL DEFAULT '/',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "categoryId" UUID,
    "brand" TEXT,
    "description" TEXT,
    "kaspiFamilyId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variant" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "kaspiMasterTitle" TEXT,
    "kaspiTitle" TEXT,
    "kaspiModel" TEXT,
    "kaspiMasterSku" TEXT,
    "kaspiOfferId" TEXT,
    "kaspiFileId" TEXT,
    "kaspiMerchantUid" TEXT,
    "kaspiShopLink" TEXT,
    "kaspiImages" JSONB,
    "kaspiUpdates" JSONB,
    "kaspiUpdatedAt" TIMESTAMP(3),
    "anyKaspiDelivery" BOOLEAN NOT NULL DEFAULT false,
    "anyKaspiDeliveryExpress" BOOLEAN NOT NULL DEFAULT false,
    "anyKaspiDeliveryLocal" BOOLEAN NOT NULL DEFAULT false,
    "anyMerchantDelivery" BOOLEAN NOT NULL DEFAULT false,
    "siteDelivery" BOOLEAN NOT NULL DEFAULT false,
    "purchasePrice" DECIMAL(12,2),
    "minChannelPrice" DECIMAL(12,2),
    "maxChannelPrice" DECIMAL(12,2),
    "fabricId" UUID,
    "fabricShadeId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "channel" "SalesChannel" NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'ON_SALE',
    "price" DECIMAL(12,2),
    "discountPrice" DECIMAL(12,2),
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "externalId" TEXT,
    "externalSku" TEXT,
    "externalUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "syncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantStock" (
    "id" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "quantity" INTEGER,
    "preOrderDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariantStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fabric" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fabric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FabricShade" (
    "id" UUID NOT NULL,
    "fabricId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hex" TEXT,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FabricShade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantChange" (
    "id" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "source" "ChangeSource" NOT NULL,
    "userId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VariantChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_path_idx" ON "Category"("path");

-- CreateIndex
CREATE UNIQUE INDEX "Category_parentId_name_key" ON "Category"("parentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_kaspiFamilyId_idx" ON "Product"("kaspiFamilyId");

-- CreateIndex
CREATE UNIQUE INDEX "Variant_sku_key" ON "Variant"("sku");

-- CreateIndex
CREATE INDEX "Variant_productId_idx" ON "Variant"("productId");

-- CreateIndex
CREATE INDEX "Variant_fabricId_idx" ON "Variant"("fabricId");

-- CreateIndex
CREATE INDEX "Variant_kaspiMasterSku_idx" ON "Variant"("kaspiMasterSku");

-- CreateIndex
CREATE INDEX "Listing_channel_externalId_idx" ON "Listing"("channel", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_variantId_channel_key" ON "Listing"("variantId", "channel");

-- CreateIndex
CREATE INDEX "VariantStock_warehouseId_idx" ON "VariantStock"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "VariantStock_variantId_warehouseId_key" ON "VariantStock"("variantId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "Fabric_code_key" ON "Fabric"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FabricShade_fabricId_code_key" ON "FabricShade"("fabricId", "code");

-- CreateIndex
CREATE INDEX "VariantChange_variantId_createdAt_idx" ON "VariantChange"("variantId", "createdAt");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "Fabric"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_fabricShadeId_fkey" FOREIGN KEY ("fabricShadeId") REFERENCES "FabricShade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantStock" ADD CONSTRAINT "VariantStock_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantStock" ADD CONSTRAINT "VariantStock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricShade" ADD CONSTRAINT "FabricShade_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "Fabric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantChange" ADD CONSTRAINT "VariantChange_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
