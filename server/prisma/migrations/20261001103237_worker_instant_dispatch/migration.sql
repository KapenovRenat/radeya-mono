-- AlterEnum
ALTER TYPE "DispatchRecipient" ADD VALUE 'DEVELOPER';

-- AlterTable
ALTER TABLE "WorkerSettings" ADD COLUMN     "supplierNotifyInstant" BOOLEAN NOT NULL DEFAULT false;
