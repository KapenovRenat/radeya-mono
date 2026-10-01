-- Написана руками, а не сгенерирована: Prisma оформила бы переименование как
-- DROP + ADD и потеряла бы уже вписанную группу Астаны. Прежняя единая группа
-- становится группой Kaspi Доставки (отгрузки на Zammler) — решение пользователя.

-- AlterTable
ALTER TABLE "Warehouse" RENAME COLUMN "telegramChatId" TO "kaspiDeliveryChatId";
ALTER TABLE "Warehouse" ADD COLUMN     "ownDeliveryChatId" TEXT,
ADD COLUMN     "pickupChatId" TEXT;
