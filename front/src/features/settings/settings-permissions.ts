import { PERMISSIONS, type Permission } from "@radeya/shared";

/**
 * Права блоков настроек — одно место для layout, страницы и ссылки в меню:
 * раздел виден, если открыт хотя бы один блок.
 */
export const SETTINGS_BLOCK_PERMISSIONS = {
  kaspiCabinet: PERMISSIONS.KASPI_CABINET_MANAGE,
  workers: PERMISSIONS.WORKERS_MANAGE,
  telegram: [PERMISSIONS.SUPPLIERS_EDIT, PERMISSIONS.WAREHOUSES_MANAGE] as Permission[],
  warehouses: PERMISSIONS.WAREHOUSES_MANAGE,
} as const;

export const SETTINGS_PERMISSIONS: Permission[] = [
  PERMISSIONS.KASPI_CABINET_MANAGE,
  PERMISSIONS.WORKERS_MANAGE,
  PERMISSIONS.SUPPLIERS_EDIT,
  PERMISSIONS.WAREHOUSES_MANAGE,
];
