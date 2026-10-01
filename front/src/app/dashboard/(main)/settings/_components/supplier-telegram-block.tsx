"use client";

import { useId } from "react";
import { SUPPLIER_TELEGRAM_ID_MAX_LENGTH } from "@radeya/shared";

import { Button } from "@/components/button";
import { Dropdown, type DropdownOption } from "@/components/dropdown";
import { Input } from "@/components/input";
import { Modal } from "@/components/modal";
import { useGetSuppliersQuery } from "@/features/suppliers/suppliers-api";
import { useSupplierTelegramForm } from "@/features/suppliers/use-supplier-telegram-form";
import { useAstanaGroupForm } from "@/features/warehouses/use-astana-group-form";

/**
 * Получатели в Telegram: группа «Из наличия в Астане» и поставщики.
 * Выбрал поставщика — окно с его данными и полем Telegram ID. По этим ID
 * воркер шлёт заказы, отмены и возвраты (docs/workers.md).
 */
export function SupplierTelegramBlock() {
  const suppliers = useGetSuppliersQuery();
  const items = suppliers.data?.items ?? [];
  const form = useSupplierTelegramForm(items);
  const astana = useAstanaGroupForm();
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
      <h2 id={formId + "-title"} className="text-lg font-semibold">Получатели в Telegram</h2>

      <div className="max-w-md space-y-2">
        <Input
          id={formId + "-astana"}
          label="Из наличия в Астане — Telegram ID группы"
          value={astana.value}
          onChange={(event) => astana.setValue(event.target.value)}
          placeholder="Группа — -100…"
          inputMode="numeric"
          autoComplete="off"
          disabled={astana.warehouse === null || astana.isSaving}
        />

        <p className="text-sm">
          Сюда уходят заказы в наличии со склада Астаны. Всё остальное — предзаказы
          и наличие с других складов — поставщику товара.
        </p>

        {!astana.isLoading && astana.warehouse === null && (
          <p role="alert" className="text-sm text-destructive">
            Склада Астаны (PP3) нет в справочнике — сначала загрузите склады.
          </p>
        )}

        <Button
          type="button"
          disabled={!astana.isDirty || astana.isSaving}
          onClick={() => { void astana.save(); }}
        >
          {astana.isSaving ? "Сохраняю…" : "Сохранить"}
        </Button>

        {astana.error && <p role="alert" className="text-sm text-destructive">{astana.error}</p>}
        {astana.notice && <p role="status" className="text-sm">{astana.notice}</p>}
      </div>

      <p className="text-sm">
        Без Telegram ID поставщику не уйдут заказы.
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
