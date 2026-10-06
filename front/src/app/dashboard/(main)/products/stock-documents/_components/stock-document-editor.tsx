"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  STOCK_DOCUMENT_COMMENT_MAX_LENGTH,
  STOCK_DOCUMENT_TYPES,
  STOCK_DOCUMENT_TYPE_LABELS,
  formatStockDocumentNumber,
  type StockDocumentDto,
  type StockDocumentType,
} from "@radeya/shared";

import { Button } from "@/components/button";
import { Checkbox } from "@/components/checkbox";
import { Dropdown, type DropdownOption } from "@/components/dropdown";
import { Modal } from "@/components/modal";
import { ProductPicker } from "@/components/product-picker";
import { useStockDocumentDraft } from "@/features/stock-documents/use-stock-document-draft";
import { useStockPicker } from "@/features/stock-documents/use-stock-picker";
import { tiynToTenge } from "@/features/stock-documents/stock-money";
import { useGetWarehousesQuery } from "@/features/warehouses/warehouses-api";
import { formatDateTime, formatMoney, formatMoneyExact, moneyToNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DocumentStatus, STOCK_DOCUMENTS_HREF, documentHref, warehouseLabel } from "./document-meta";
import { StockDocumentLines } from "./stock-document-lines";
import styles from "./stock-documents.module.scss";

const TYPE_OPTIONS: DropdownOption[] = Object.values(STOCK_DOCUMENT_TYPES).map((type) => ({
  value: type,
  label: STOCK_DOCUMENT_TYPE_LABELS[type],
}));

/**
 * Документ склада: новый, черновик или проведённый (только чтение).
 *
 * Состояние формы — в useStockDocumentDraft, выбор товаров — в useStockPicker;
 * здесь только раскладка и связка между ними.
 */
export function StockDocumentEditor({ document }: { document: StockDocumentDto | null }) {
  const router = useRouter();
  const commentId = useId();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const callbacks = useMemo(() => ({
    // replace: «назад» не должен возвращать на пустую форму нового документа.
    onCreated: (created: StockDocumentDto) => router.replace(documentHref(created.number)),
    onDeleted: () => router.replace(STOCK_DOCUMENTS_HREF),
  }), [router]);

  const draft = useStockDocumentDraft(document, callbacks);
  const picker = useStockPicker(draft.warehouseId, draft.addVariants);
  const warehouses = useGetWarehousesQuery();

  // Новый документ — только на действующий склад. Склад старого документа
  // остаётся в списке, даже если его закрыли: иначе поле было бы пустым.
  const warehouseOptions: DropdownOption[] = (warehouses.data?.items ?? [])
    .filter((warehouse) => warehouse.isActive || warehouse.id === draft.warehouseId)
    .map((warehouse) => ({
      value: warehouse.id,
      label: warehouseLabel(warehouse),
      ...(warehouse.kaspiStoreId === null ? { note: "наш склад" } : {}),
      ...(warehouse.isActive ? {} : { note: "закрыт", disabled: true }),
    }));

  const inDocument = new Set(draft.lines.map((line) => line.variant.id));
  const busy = draft.isSaving || draft.isDeleting;
  // Пустой комментарий подсвечивается сразу, а не после первой попытки:
  // так просил пользователь — создать документ без пояснения нельзя.
  const showCommentError = !draft.readOnly && draft.commentError !== null;

  const title = document === null
    ? "Новый документ"
    : `${STOCK_DOCUMENT_TYPE_LABELS[document.type]} № ${formatStockDocumentNumber(document.number)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {document !== null && <DocumentStatus postedAt={document.postedAt} />}
        {draft.isDirty && <span className={styles.muted}>есть несохранённые изменения</span>}
      </div>

      {document !== null && (
        <p className={styles.meta}>
          Создал {document.createdBy.name}, {formatDateTime(document.createdAt)}
          {document.postedAt !== null && document.postedBy !== null
            && ` · Провёл ${document.postedBy.name}, ${formatDateTime(document.postedAt)}`}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <span className="text-sm">Тип документа</span>
          <Dropdown
            mode="select"
            label="Тип документа"
            options={TYPE_OPTIONS}
            value={draft.type}
            onChange={(value) => draft.setType(value as StockDocumentType)}
            disabled={draft.readOnly || busy}
          />
        </div>

        <div className="space-y-1">
          <span className="text-sm">Склад</span>
          <Dropdown
            mode="select"
            searchable
            searchPlaceholder="Поиск склада"
            label="Склад"
            placeholder="Выберите склад"
            options={warehouseOptions}
            value={draft.warehouseId}
            onChange={draft.setWarehouseId}
            disabled={draft.readOnly || busy}
          />
        </div>

        <label className="space-y-1 md:col-span-2" htmlFor={commentId}>
          <span className="text-sm">Комментарий <span className={styles.required}>*</span></span>
          <textarea
            id={commentId}
            className={cn(styles.textarea, showCommentError && styles.textareaError)}
            aria-invalid={showCommentError}
            aria-describedby={showCommentError ? commentId + "-error" : undefined}
            value={draft.comment}
            onChange={(event) => draft.setComment(event.target.value)}
            maxLength={STOCK_DOCUMENT_COMMENT_MAX_LENGTH}
            readOnly={draft.readOnly}
            disabled={busy}
            rows={2}
            placeholder={draft.readOnly ? "" : "Например: ревизия 09.10, возврат клиента"}
          />
          {showCommentError && (
            <span id={commentId + "-error"} className={styles.fieldError}>{draft.commentError}</span>
          )}
        </label>
      </div>

      {!draft.readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={picker.open} disabled={draft.warehouseId === "" || busy} className="">
            <Plus size={16} aria-hidden="true" /> Добавить товары
          </Button>
          {draft.warehouseId === "" && <span className={styles.muted}>Сначала выберите склад</span>}
          {!draft.isEnter && (
            <span className={styles.muted}>Списание идёт по себестоимости товара на момент проведения.</span>
          )}
        </div>
      )}

      <StockDocumentLines
        lines={draft.lines}
        isEnter={draft.isEnter}
        readOnly={draft.readOnly}
        onQuantityChange={draft.setQuantity}
        onPriceChange={draft.setPrice}
        onRemove={draft.removeLine}
      />

      <div className={styles.total}>
        <span>Товаров: {draft.lines.length}, штук: {draft.totalQuantity}</span>
        <strong>Итого: {formatMoneyExact(tiynToTenge(draft.totalTiyn))}</strong>
      </div>

      {draft.error && <p role="alert" aria-live="polite" className="text-sm text-destructive">{draft.error}</p>}

      {(draft.canPost || draft.isPosted) && (
        <div className={cn(styles.postBox, draft.postOnSave && !draft.isPosted && styles.postBoxActive)}>
          <Checkbox
            label="Проведено"
            checked={draft.postOnSave}
            disabled={draft.readOnly || busy}
            onChange={(event) => draft.setPostOnSave(event.target.checked)}
          />
          {!draft.isPosted && (
            <span className={styles.postNote}>
              {draft.postOnSave
                ? "При сохранении остатки изменятся — документ больше нельзя будет править и удалить."
                : "Без галочки документ сохранится черновиком: остатки не изменятся."}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!draft.readOnly && (
          <Button type="button" onClick={() => void draft.save()} disabled={busy || draft.commentError !== null} className="">
            {draft.isSaving ? "Сохраняю…" : document === null ? "Создать" : "Сохранить"}
          </Button>
        )}

        {document !== null && !draft.readOnly && (
          <Button type="button" onClick={() => setIsDeleteOpen(true)} disabled={busy} className="">
            Удалить черновик
          </Button>
        )}

        <Link href={STOCK_DOCUMENTS_HREF} className={styles.backLink}>К списку документов</Link>
      </div>

      <ProductPicker
        open={picker.isOpen}
        onClose={picker.close}
        search={picker.search}
        onSearchChange={picker.setSearch}
        items={picker.items.map((variant) => ({
          id: variant.id,
          title: variant.name,
          sku: variant.sku,
          imageUrl: variant.imageUrl,
          disabled: inDocument.has(variant.id),
          aside: (
            <>
              Остаток: {variant.quantity ?? "—"}
              {variant.costPrice !== null && <><br />{formatMoney(moneyToNumber(variant.costPrice) ?? 0)}</>}
            </>
          ),
        }))}
        selectedIds={picker.selectedIds}
        onToggle={(id) => {
          const variant = picker.items.find((item) => item.id === id);
          if (variant) picker.toggle(variant);
        }}
        page={picker.page}
        totalPages={picker.totalPages}
        onPageChange={picker.setPage}
        onConfirm={picker.confirm}
        isLoading={picker.isLoading}
        error={picker.error}
      />

      <Modal
        open={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Удалить черновик?"
        footer={
          <>
            <Button type="button" onClick={() => setIsDeleteOpen(false)} disabled={draft.isDeleting} className="">
              Отмена
            </Button>
            <Button type="button" disabled={draft.isDeleting} className="" onClick={() => {
              setIsDeleteOpen(false);
              void draft.remove();
            }}>
              {draft.isDeleting ? "Удаляю…" : "Удалить"}
            </Button>
          </>
        }
      >
        <p>Черновик остатки не менял — удаление ничего не вернёт и не спишет. Номер документа больше не будет использован.</p>
      </Modal>
    </div>
  );
}
