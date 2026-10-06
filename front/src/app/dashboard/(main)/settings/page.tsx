"use client";

import { KaspiCabinetBlock } from "./_components/kaspi-cabinet-block";
import { SupplierTelegramBlock } from "./_components/supplier-telegram-block";
import { WarehousesBlock } from "./_components/warehouses-block";
import { WorkersBlock } from "./_components/workers-block";

/**
 * Настройки — независимые блоки, по одному на внешнюю систему.
 */
export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Настройки</h1>

      <KaspiCabinetBlock />
      <WorkersBlock />
      {/* Отдельно от воркера: Telegram ID — свойство поставщика, а не настройка отправки. */}
      <SupplierTelegramBlock />
      <WarehousesBlock />
    </div>
  );
}
