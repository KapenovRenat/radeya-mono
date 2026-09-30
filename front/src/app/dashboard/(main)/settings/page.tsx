"use client";

import { KaspiCabinetBlock } from "./_components/kaspi-cabinet-block";

/**
 * Настройки — независимые блоки, по одному на внешнюю систему.
 * Первый — доступ в кабинет Kaspi.
 */
export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Настройки</h1>

      <KaspiCabinetBlock />
    </div>
  );
}
