"use client";

import { useState } from "react";
import { PERMISSIONS } from "@radeya/shared";

import { Button } from "@/components/button";
import { useCan } from "@/features/auth/use-can";
import { useUserForm } from "@/features/users/use-user-form";
import { cn } from "@/lib/utils";
import { AuditTable } from "./_components/audit-table";
import { UserDialog } from "./_components/user-dialog";
import { UsersTable } from "./_components/users-table";

/** Вкладки — каждая по своему праву: сотрудники и журнал раздаются отдельно. */
const TABS = [
  { id: "accounts", label: "Аккаунты", permission: PERMISSIONS.USERS_MANAGE },
  { id: "history", label: "История", permission: PERMISSIONS.AUDIT_VIEW },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AccountsPage() {
  const can = useCan();
  const tabs = TABS.filter((item) => can(item.permission));
  const [selected, setTab] = useState<TabId | null>(null);
  // Выбранная вкладка могла стать недоступной — тогда первая доступная.
  const tab = tabs.find((item) => item.id === selected)?.id ?? tabs[0]?.id;
  const userForm = useUserForm();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Аккаунты и История</h1>

      {/* role="tablist" и клавиатурная навигация появятся, когда табы станут
          общим компонентом. Пока это разметка под доработку вёрстки. */}
      <div className="flex gap-2 border-b">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "px-4 py-2 text-sm",
              tab === item.id
                ? "border-b-2 border-primary font-medium"
                : "text-muted-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "accounts" && (
        <div className="space-y-4">
          <Button type="button" onClick={userForm.openCreate}>
            Добавить аккаунт
          </Button>

          <UsersTable onOpen={userForm.openEdit} />

          <UserDialog form={userForm} />
        </div>
      )}

      {tab === "history" && <AuditTable />}
    </div>
  );
}
