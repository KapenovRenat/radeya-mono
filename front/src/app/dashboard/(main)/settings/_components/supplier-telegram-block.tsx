"use client";

import { useId } from "react";
import { SUPPLIER_TELEGRAM_ID_MAX_LENGTH } from "@radeya/shared";

import { Button } from "@/components/button";
import { Dropdown, type DropdownOption } from "@/components/dropdown";
import { Input } from "@/components/input";
import { Modal } from "@/components/modal";
import { useGetSuppliersQuery } from "@/features/suppliers/suppliers-api";
import { useSupplierTelegramForm } from "@/features/suppliers/use-supplier-telegram-form";

/**
 * Поставщики и их Telegram: выбрал поставщика — окно с его данными и полем
 * Telegram ID. По этому ID воркер шлёт поставщику заказы, отмены и возвраты.
 */
export function SupplierTelegramBlock() {
  const suppliers = useGetSuppliersQuery();
  const items = suppliers.data?.items ?? [];
  const form = useSupplierTelegramForm(items);
  const formId = useId();

  const options: DropdownOption[] = items.map((supplier) => ({
    value: supplier.id,
    label: supplier.name,
    // Видно сразу, кому ещё некуда слать.
    note: !supplier.isActive ? "закрыт" : supplier.telegramId ? undefined : "нет Telegram",
  }));

  const withoutTelegram = items.filter((supplier) => supplier.isActive && !supplier.telegramId).length;

  return (
    <section className="space-y-3" aria-labelledby={formId + "-title"}>
      <h2 id={formId + "-title"} className="text-lg font-semibold">Поставщики в Telegram</h2>

      <p className="text-sm">
        Без Telegram ID поставщику не уйдут уведомления о заказах.
        {withoutTelegram > 0 && ` Сейчас без Telegram: ${withoutTelegram}.`}
      </p>

      <Dropdown
        mode="select"
        searchable
        label="Поставщик"
        placeholder="Выберите поставщика"
        options={options}
        value={form.supplier?.id}
        onChange={form.open}
        disabled={items.length === 0}
      />

      <Modal
        open={form.isOpen}
        onClose={form.close}
        title={form.supplier?.name ?? "Поставщик"}
        footer={
          <>
            <Button type="button" onClick={form.close} disabled={form.isSaving}>Отмена</Button>
            <Button type="submit" form={formId} disabled={form.isSaving}>
              {form.isSaving ? "Сохраняю…" : "Сохранить"}
            </Button>
          </>
        }
      >
        {form.supplier && (
          <form
            id={formId}
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void form.save();
            }}
          >
            <dl className="text-sm">
              <div><dt className="inline">Адрес: </dt><dd className="inline">{form.supplier.address ?? "—"}</dd></div>
              <div><dt className="inline">Телефон: </dt><dd className="inline">{form.supplier.phone ?? "—"}</dd></div>
              <div>
                <dt className="inline">Источник: </dt>
                <dd className="inline">{form.supplier.externalId ? "МойСклад" : "заведён руками"}</dd>
              </div>
            </dl>

            <Input
              id={formId + "-telegram"}
              label="Telegram ID"
              value={form.telegramId}
              onChange={(event) => form.setTelegramId(event.target.value)}
              maxLength={SUPPLIER_TELEGRAM_ID_MAX_LENGTH}
              placeholder="Личка — 123456789, группа — -100…"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
            />

            {form.error && <p role="alert" className="text-sm text-destructive">{form.error}</p>}
          </form>
        )}
      </Modal>
    </section>
  );
}
