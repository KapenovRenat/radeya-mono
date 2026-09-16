/*
  Warnings:

  - You are about to drop the column `isActive` on the `Variant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Variant" DROP COLUMN "isActive",
ADD COLUMN     "status" "ListingStatus" NOT NULL DEFAULT 'ON_SALE';
