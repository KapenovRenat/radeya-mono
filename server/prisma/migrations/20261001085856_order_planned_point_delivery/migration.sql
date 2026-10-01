-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cabinetSyncedAt" TIMESTAMP(3),
ADD COLUMN     "plannedPointDeliveryAt" TIMESTAMP(3);
