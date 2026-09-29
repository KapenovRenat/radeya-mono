/*
  Warnings:

  - You are about to drop the `VariantChange` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "ChangeSource" ADD VALUE 'IMPORT';

-- DropForeignKey
ALTER TABLE "VariantChange" DROP CONSTRAINT "VariantChange_variantId_fkey";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "changes" JSONB,
ADD COLUMN     "context" JSONB,
ADD COLUMN     "source" "ChangeSource";

-- AlterTable
ALTER TABLE "Variant" ADD COLUMN     "costPrice" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "VariantStock" ADD COLUMN     "expected" INTEGER,
ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "reserved" INTEGER,
ADD COLUMN     "stockAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "VariantChange";

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_at_idx" ON "AuditLog"("entityType", "entityId", "at");
