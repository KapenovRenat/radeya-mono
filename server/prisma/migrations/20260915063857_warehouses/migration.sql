-- CreateTable
CREATE TABLE "Warehouse" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "kaspiStoreId" TEXT NOT NULL,
    "kaspiCityId" TEXT,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_kaspiStoreId_key" ON "Warehouse"("kaspiStoreId");
