-- Написана руками: Prisma не генерирует данные. Отдельно от user_permissions,
-- чтобы не править уже созданный (возможно, применённый) файл миграции.
--
-- Текущим сотрудникам — права по роли, как они были до перехода на галочки
-- (ROLE_PERMISSION_TEMPLATES в shared/src/constants/permissions.ts на 07.10.2026).
-- Только тем, у кого прав ещё нет: повторный прогон не затрёт выданное руками.
-- ADMIN не заполняется — админу можно всё без галочек.

UPDATE "User" SET "permissions" = ARRAY[
  'STATS_VIEW', 'ORDERS_VIEW', 'ORDERS_COMMENT', 'ORDERS_SYNC', 'ORDERS_CREATE_OFFLINE',
  'CATALOG_VIEW', 'CATALOG_EDIT_FOLDERS', 'STOCK_DOCUMENTS_VIEW', 'STOCK_DOCUMENTS_EDIT', 'DICTIONARIES_EDIT'
]::TEXT[]
WHERE "role" = 'MANAGER' AND COALESCE(cardinality("permissions"), 0) = 0;

UPDATE "User" SET "permissions" = ARRAY[
  'STATS_VIEW', 'ORDERS_VIEW', 'ORDERS_COMMENT', 'ORDERS_CREATE_OFFLINE', 'CATALOG_VIEW'
]::TEXT[]
WHERE "role" = 'SELLER' AND COALESCE(cardinality("permissions"), 0) = 0;

UPDATE "User" SET "permissions" = ARRAY[
  'STATS_VIEW', 'ORDERS_VIEW', 'ORDERS_COMMENT', 'CATALOG_VIEW'
]::TEXT[]
WHERE "role" = 'VIEWER' AND COALESCE(cardinality("permissions"), 0) = 0;
