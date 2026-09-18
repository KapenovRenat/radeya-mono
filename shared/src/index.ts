// Единственная точка входа пакета: и server, и front импортируют только отсюда.
// Добавил файл в constants/ или types/ — не забудь реэкспортировать здесь.

export * from './constants/roles';
export * from './constants/order-sources';
export * from './constants/audit-actions';
export * from './constants/credentials';
export * from './constants/sales-channels';
export * from './types/api';
export * from './types/auth';
export * from './types/users';
export * from './types/audit';
export * from './types/kaspi-catalog';
export * from './types/kaspi-cabinet';
export * from './types/products';
export * from './constants/catalog';
export * from './types/catalog';
