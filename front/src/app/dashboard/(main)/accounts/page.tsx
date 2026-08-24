"use client";

import { useState } from "react";

import { Button } from "@/components/button";
import { cn } from "@/lib/utils";
import { AuditTable } from "./_components/audit-table";
import { CreateUserDialog } from "./_components/create-user-dialog";
import { UsersTable } from "./_components/users-table";
import {useAuth} from "@/features/auth/use-auth";
import {USER_ROLES} from "@radeya/shared";

const TABS = [
  { id: "accounts", label: "Аккаунты" },
  { id: "history", label: "История" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AccountsPage() {
  const [tab, setTab] = useState<TabId>("accounts");
  const [isDialogOpen, setDialogOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Аккаунты и История</h1>

      {/* role="tablist" и клавиатурная навигация появятся, когда табы станут
          общим компонентом. Пока это разметка под доработку вёрстки. */}
      <div className="flex gap-2 border-b">
        {TABS.map((item) => (
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
            {user?.role === USER_ROLES.ADMIN ? <Button type="button" onClick={() => setDialogOpen(true)}>
            Добавить аккаунт
          </Button> : null}

          <UsersTable />

          <CreateUserDialog
            open={isDialogOpen}
            onClose={() => setDialogOpen(false)}
          />
        </div>
      )}

      {tab === "history" && <AuditTable />}
    </div>
  );
}
