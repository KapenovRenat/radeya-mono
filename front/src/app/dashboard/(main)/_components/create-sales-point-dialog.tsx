"use client";

import { useId } from "react";
import { SALES_POINT_NAME_MAX_LENGTH } from "@radeya/shared";

import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Modal } from "@/components/modal";
import type { useCreateSalesPointForm } from "@/features/sales-points/use-create-sales-point-form";

/**
 * Состояние формы живёт в хуке у страницы, а не здесь: кнопка, открывающая
 * окно, стоит снаружи, и держать `isOpen` внутри окна значило бы прокидывать
 * наверх ещё один колбэк.
 */
type SalesPointForm = ReturnType<typeof useCreateSalesPointForm>;

/**
 * Новая офлайн-точка продаж.
 *
 * Поле одно — название. Код (`OFF-1`, `OFF-2`) генерит сервер, тип через API
 * всегда офлайновый: спрашивать их у человека нечего.
 */
export function CreateSalesPointDialog({ form }: { form: SalesPointForm }) {
  // Кнопка отправки лежит в подвале модалки, а поле — в теле: связать их
  // можно только атрибутом form, общего <form> вокруг них нет.
  const formId = useId();

  return (
    <Modal
      open={form.isOpen}
      onClose={form.close}
      title="Новая точка продаж"
      footer={
        <>
          <Button type="button" onClick={form.close} disabled={form.isSaving}>
            Отмена
          </Button>

          <Button type="submit" form={formId} disabled={form.isSaving}>
            {form.isSaving ? "Создаю…" : "Создать"}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          // Иначе страница перезагрузится: обработчик асинхронный,
          // и браузер успеет отправить форму сам.
          event.preventDefault();
          void form.submit();
        }}
      >
        <Input
          id={formId + "-name"}
          label="Название"
          value={form.name}
          onChange={(event) => form.setName(event.target.value)}
          maxLength={SALES_POINT_NAME_MAX_LENGTH}
          placeholder="Например, Точка на Абая"
          autoComplete="off"
          autoFocus
        />

        {form.error && (
          // aria-live: ошибка приходит после отправки, и без него
          // скринридер о ней не узнает.
          <p role="alert" aria-live="polite" className="mt-2 text-sm text-destructive">
            {form.error}
          </p>
        )}
      </form>
    </Modal>
  );
}
