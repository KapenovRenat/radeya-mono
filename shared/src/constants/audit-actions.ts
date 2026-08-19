/**
 * Действия, попадающие в журнал. Именованные константы, а не строки по месту
 * вызова: опечатка в строке молча создаст новый вид действия, и фильтр по журналу
 * его не найдёт.
 *
 * Набор дополняется по мере появления разделов.
 */
export const AUDIT_ACTIONS = {
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGIN_FAILED: 'USER_LOGIN_FAILED',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_CREATED: 'USER_CREATED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/** Подписи действий для журнала в интерфейсе. */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  USER_LOGIN: 'Вход в систему',
  USER_LOGIN_FAILED: 'Неудачная попытка входа',
  USER_LOGOUT: 'Выход из системы',
  USER_CREATED: 'Создан сотрудник',
  USER_ROLE_CHANGED: 'Изменена роль',
  USER_DEACTIVATED: 'Сотрудник отключён',
};
