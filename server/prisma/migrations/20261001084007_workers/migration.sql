-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('STOPPED', 'IDLE', 'RUNNING', 'ERROR');

-- CreateTable
CREATE TABLE "WorkerSettings" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 2,
    "periodMonths" INTEGER NOT NULL DEFAULT 1,
    "supplierNotifyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "supplierNotifyDelayMinutes" INTEGER NOT NULL DEFAULT 60,
    "supplierNotifyWeekdays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6]::INTEGER[],
    "supplierNotifyFrom" TIMESTAMP(3),
    "devAlertsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "devChatId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerSettings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "WorkerState" (
    "key" TEXT NOT NULL,
    "status" "WorkerStatus" NOT NULL DEFAULT 'STOPPED',
    "heartbeatAt" TIMESTAMP(3),
    "runStartedAt" TIMESTAMP(3),
    "lastRunFinishedAt" TIMESTAMP(3),
    "lastRunTookMs" INTEGER,
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3),
    "lastRunStats" JSONB,
    "downNotified" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerState_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "WorkerEvent" (
    "id" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workerKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "orderId" UUID,
    "orderCode" TEXT,
    "orderPlacedAt" TIMESTAMP(3),
    "orderCreatedAt" TIMESTAMP(3),
    "message" TEXT NOT NULL,
    "details" JSONB,

    CONSTRAINT "WorkerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkerEvent_at_idx" ON "WorkerEvent"("at");

-- CreateIndex
CREATE INDEX "WorkerEvent_orderId_at_idx" ON "WorkerEvent"("orderId", "at");

-- CreateIndex
CREATE INDEX "WorkerEvent_orderCode_idx" ON "WorkerEvent"("orderCode");

-- CreateIndex
CREATE INDEX "WorkerEvent_type_at_idx" ON "WorkerEvent"("type", "at");

-- AddForeignKey
ALTER TABLE "WorkerEvent" ADD CONSTRAINT "WorkerEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
