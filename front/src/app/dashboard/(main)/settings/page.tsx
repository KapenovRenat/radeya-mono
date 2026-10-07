"use client";

import { useCan } from "@/features/auth/use-can";
import { SETTINGS_BLOCK_PERMISSIONS } from "@/features/settings/settings-permissions";
import { KaspiCabinetBlock } from "./_components/kaspi-cabinet-block";
import { SupplierTelegramBlock } from "./_components/supplier-telegram-block";
import { WarehousesBlock } from "./_components/warehouses-block";
import { WorkersBlock } from "./_components/workers-block";

/**
 * Настройки — независимые блоки, по одному на внешнюю систему.
 * Каждый блок — по своему праву (SETTINGS_BLOCK_PERMISSIONS).
 */
export default function SettingsPage() {
  const can = useCan();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Настройки</h1>

      {can(SETTINGS_BLOCK_PERMISSIONS.kaspiCabinet) && <KaspiCabinetBlock />}
      {can(SETTINGS_BLOCK_PERMISSIONS.workers) && <WorkersBlock />}
      {/* Отдельно от воркера: Telegram ID — свойство поставщика, а не настройка отправки. */}
      {can(SETTINGS_BLOCK_PERMISSIONS.telegram) && <SupplierTelegramBlock />}
      {can(SETTINGS_BLOCK_PERMISSIONS.warehouses) && <WarehousesBlock />}
    </div>
  );
}
