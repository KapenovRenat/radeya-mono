-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('KZT', 'RUB');

-- AlterTable
ALTER TABLE "Variant" ADD COLUMN     "purchaseCurrency" "Currency",
ADD COLUMN     "supplierId" UUID;

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
