import {
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_INFO,
  type Permission,
} from "@radeya/shared";

import { Checkbox } from "@/components/checkbox";
import styles from "./accounts.module.scss";

interface PermissionsChecklistProps {
  value: readonly Permission[];
  onToggle: (permission: Permission, checked: boolean) => void;
  /** Можно ли менять эту галочку: чужие права и права админа — нет. */
  canToggle: (permission: Permission) => boolean;
  /** Админ — все галочки стоят и не снимаются: ему можно всё. */
  isAdmin: boolean;
}

/**
 * Галочки прав по группам. Список и подписи — из PERMISSIONS в shared:
 * новое право появится здесь само, снятым у всех.
 */
export function PermissionsChecklist({ value, onToggle, canToggle, isAdmin }: PermissionsChecklistProps) {
  const checked = new Set(value);

  return (
    <div className={styles.permissions}>
      {isAdmin && <p className={styles.note}>Админ может всё — галочки ему не нужны.</p>}

      {PERMISSION_GROUPS.map((group) => {
        const items = ALL_PERMISSIONS.filter((permission) => PERMISSION_INFO[permission].group === group);

        if (items.length === 0) return null;

        return (
          <fieldset key={group} className={styles.group}>
            <legend className={styles.groupTitle}>{group}</legend>

            {items.map((permission) => {
              const info = PERMISSION_INFO[permission];

              return (
                <div key={permission} className={styles.permission}>
                  <Checkbox
                    label={info.label}
                    checked={isAdmin || checked.has(permission)}
                    disabled={!canToggle(permission)}
                    onChange={(event) => onToggle(permission, event.target.checked)}
                  />
                  {info.hint && <span className={styles.hint}>{info.hint}</span>}
                </div>
              );
            })}
          </fieldset>
        );
      })}
    </div>
  );
}
