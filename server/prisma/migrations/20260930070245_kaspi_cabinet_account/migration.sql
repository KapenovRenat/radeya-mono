-- CreateEnum
CREATE TYPE "KaspiLoginStatus" AS ENUM ('OK', 'CODE_REQUIRED', 'MERCHANT_CHOICE_REQUIRED', 'CREDENTIALS_INVALID', 'BLOCKED', 'ERROR');

-- CreateTable
CREATE TABLE "KaspiCabinetAccount" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "email" TEXT NOT NULL,
    "passwordEncrypted" TEXT NOT NULL,
    "sessionEncrypted" TEXT,
    "lastLoginStatus" "KaspiLoginStatus",
    "lastLoginError" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "blockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KaspiCabinetAccount_pkey" PRIMARY KEY ("id")
);
