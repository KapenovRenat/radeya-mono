"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  STOCK_DOCUMENT_COMMENT_MAX_LENGTH,
  STOCK_DOCUMENT_COMMENT_MIN_LENGTH,
  STOCK_DOCUMENT_MAX_LINES,
  STOCK_DOCUMENT_MAX_QUANTITY,
  STOCK_DOCUMENT_POST_ROLES,
  STOCK_DOCUMENT_ROLES,
  STOCK_DOCUMENT_TYPES,
  type SaveStockDocumentRequest,
  type StockDocumentDto,
  type StockDocumentType,
  type StockVariantDto,
} from "@radeya/shared";

import { useCan } from "@/features/auth/use-can";
import { apiErrorMessage } from "@/shared/api/error-message";
import {
  useCreateStockDocumentMutation,
  useDeleteStockDocumentMutation,
  useUpdateStockDocumentMutation,
} from "./stock-documents-api";
import { normalizePrice, priceToTiyn } from "./stock-money";

/** Строка черновика. Количество и цена — строками: так их правят в поле ввода. */
export interface DraftLine {
  variant: StockVariantDto;
  quantity: string;
  price: string;
  /**
   * Цена, по которой считается сумма: у оприходования — введённая, у черновика
   * списания — текущая себестоимость, у проведённого — записанная при проведении.
   */
  effectivePrice: string | null;
  /** Сумма строки в тиын; null — количество или цена введены неверно. */
  amountTiyn: number | null;
}

interface DraftCallbacks {
  /** Новый документ записан — странице пора перейти на его адрес. */
  onCreated: (document: StockDocumentDto) => void;
  onDeleted: () => void;
}

const QUANTITY_PATTERN = /^\d+$/;

/** Текст под пустым комментарием — дословно как просил пользователь. */
export const COMMENT_REQUIRED_MESSAGE = "Заполните комментарий ОСМЫСЛЕННО!";

/**
 * Черновик документа склада: шапка, строки, суммы и действия.
 *
 * `document` — сохранённый документ или null для нового. После записи сервер
 * отдаёт документ заново, и страница пересоздаёт черновик из него (по `key`),
 * поэтому здесь нет синхронизации «ответ сервера → поля формы».
 *
 * Повторное нажатие блокируется ref'ом, а не `isLoading`: между кликом
 * и обновлением состояния успевает пройти второй клик.
 */
export function useStockDocumentDraft(document: StockDocumentDto | null, callbacks: DraftCallbacks) {
  const can = useCan();
  const isPosted = document !== null && document.postedAt !== null;
  const readOnly = isPosted || !can(STOCK_DOCUMENT_ROLES);
  // Провести можно и новый документ: запись и проведение на сервере — одна транзакция.
  const canPost = !isPosted && can(STOCK_DOCUMENT_POST_ROLES);

  const [type, setTypeValue] = useState<StockDocumentType>(document?.type ?? STOCK_DOCUMENT_TYPES.ENTER);
  const [warehouseId, setWarehouseIdValue] = useState(document?.warehouse.id ?? "");
  const [comment, setCommentValue] = useState(document?.comment ?? "");
  const [rawLines, setRawLines] = useState<Omit<DraftLine, "effectivePrice" | "amountTiyn">[]>(
    () => document?.lines.map((line) => ({ variant: line.variant, quantity: String(line.quantity), price: line.price })) ?? [],
  );
  // Галочка «Проведено»: проводится по «Сохранить» / «Создать» вместе с записью.
  const [postOnSave, setPostOnSaveValue] = useState(isPosted);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const [createDocument, createState] = useCreateStockDocumentMutation();
  const [updateDocument, updateState] = useUpdateStockDocumentMutation();
  const [deleteDocument, deleteState] = useDeleteStockDocumentMutation();

  const isEnter = type === STOCK_DOCUMENT_TYPES.ENTER;

  // Черновик списания идёт по текущей себестоимости; проведённый документ
  // показывает цену, записанную при проведении, — себестоимость с тех пор могла измениться.
  const lines: DraftLine[] = useMemo(() => rawLines.map((line) => {
    const effectivePrice = isEnter || isPosted ? line.price : line.variant.costPrice;
    const quantity = QUANTITY_PATTERN.test(line.quantity) ? Number(line.quantity) : null;
    const price = priceToTiyn(effectivePrice ?? "0");

    return { ...line, effectivePrice, amountTiyn: quantity === null || price === null ? null : quantity * price };
  }), [rawLines, isEnter, isPosted]);

  const totalTiyn = lines.reduce((sum, line) => sum + (line.amountTiyn ?? 0), 0);
  const totalQuantity = lines.reduce((sum, line) => sum + (QUANTITY_PATTERN.test(line.quantity) ? Number(line.quantity) : 0), 0);

  /** Любая правка: черновик расходится с сохранённым, прежняя ошибка уже не про него. */
  const touch = useCallback(() => {
    setIsDirty(true);
    setError(null);
  }, []);

  const setType = useCallback((next: StockDocumentType) => {
    touch();
    setTypeValue(next);
    // Перешли на оприходование — пустые цены заполняются себестоимостью.
    if (next === STOCK_DOCUMENT_TYPES.ENTER) {
      setRawLines((current) => current.map((line) =>
        line.price === "" ? { ...line, price: line.variant.costPrice ?? "" } : line));
    }
  }, [touch]);

  /**
   * Сменили склад — остаток в строках был по прежнему складу. Прячем его,
   * а не показываем неверный: после записи сервер пришлёт остатки нового склада.
   */
  const setWarehouseId = useCallback((next: string) => {
    touch();
    setWarehouseIdValue(next);
    setRawLines((current) => current.map((line) => ({ ...line, variant: { ...line.variant, quantity: null } })));
  }, [touch]);

  const setPostOnSave = useCallback((next: boolean) => {
    touch();
    setPostOnSaveValue(next);
  }, [touch]);

  const setComment = useCallback((next: string) => {
    touch();
    setCommentValue(next.slice(0, STOCK_DOCUMENT_COMMENT_MAX_LENGTH));
  }, [touch]);

  /** Добавление из окна выбора: уже добавленные не дублируются, цена — себестоимость. */
  const addVariants = useCallback((variants: StockVariantDto[]) => {
    touch();
    setRawLines((current) => {
      const present = new Set(current.map((line) => line.variant.id));
      const added = variants
        .filter((variant) => !present.has(variant.id))
        .map((variant) => ({ variant, quantity: "1", price: variant.costPrice ?? "" }));

      return [...current, ...added].slice(0, STOCK_DOCUMENT_MAX_LINES);
    });
  }, [touch]);

  const removeLine = useCallback((variantId: string) => {
    touch();
    setRawLines((current) => current.filter((line) => line.variant.id !== variantId));
  }, [touch]);

  /** Только цифры: дробное или отрицательное количество в штуках смысла не имеет. */
  const setQuantity = useCallback((variantId: string, value: string) => {
    touch();
    setRawLines((current) => current.map((line) =>
      line.variant.id === variantId ? { ...line, quantity: value.replace(/D/g, "") } : line));
  }, [touch]);

  const setPrice = useCallback((variantId: string, value: string) => {
    touch();
    setRawLines((current) => current.map((line) =>
      line.variant.id === variantId ? { ...line, price: value } : line));
  }, [touch]);

  /** Комментарий обязателен: без него запись не уходит, поле подсвечено красным. */
  // Сколько осталось — иначе непонятно, почему поле с текстом всё ещё красное.
  const commentMissing = STOCK_DOCUMENT_COMMENT_MIN_LENGTH - comment.trim().length;
  const commentError = commentMissing > 0
    ? `${COMMENT_REQUIRED_MESSAGE} Ещё символов: ${commentMissing}`
    : null;

  /** Проверка перед отправкой — те же правила, что на сервере, но с понятной строкой. */
  const buildRequest = useCallback((): SaveStockDocumentRequest | string => {
    if (warehouseId === "") return "Выберите склад";
    if (commentError !== null) return commentError;
    if (lines.length === 0) return "Добавьте хотя бы один товар";

    const requestLines: SaveStockDocumentRequest["lines"] = [];

    for (const line of lines) {
      const quantity = Number(line.quantity);

      if (!QUANTITY_PATTERN.test(line.quantity) || quantity < 1 || quantity > STOCK_DOCUMENT_MAX_QUANTITY) {
        return `${line.variant.sku}: количество — от 1 до ${STOCK_DOCUMENT_MAX_QUANTITY}`;
      }

      if (isEnter && priceToTiyn(line.price) === null) {
        return `${line.variant.sku}: укажите цену — число, до двух знаков после точки`;
      }

      requestLines.push({
        variantId: line.variant.id,
        quantity,
        ...(isEnter ? { price: normalizePrice(line.price) } : {}),
      });
    }

    return { type, warehouseId, comment: comment.trim(), lines: requestLines, post: canPost && postOnSave };
  }, [canPost, comment, commentError, isEnter, lines, postOnSave, type, warehouseId]);

  /** Запись черновика. Возвращает записанный документ или null при ошибке. */
  const saveDraft = useCallback(async (): Promise<StockDocumentDto | null> => {
    const request = buildRequest();

    if (typeof request === "string") {
      setError(request);

      return null;
    }

    const saved = document === null
      ? await createDocument(request).unwrap()
      : await updateDocument({ number: document.number, ...request }).unwrap();

    setIsDirty(false);

    return saved;
  }, [buildRequest, createDocument, document, updateDocument]);

  const run = useCallback(async <T,>(action: () => Promise<T>, fallback: string): Promise<T | null> => {
    if (busy.current) return null;

    busy.current = true;
    setError(null);

    try {
      return await action();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, fallback));

      return null;
    } finally {
      busy.current = false;
    }
  }, []);

  const save = useCallback(() => run(async () => {
    const saved = await saveDraft();

    if (saved !== null && document === null) callbacks.onCreated(saved);

    return saved;
  }, "Не удалось сохранить документ"), [callbacks, document, run, saveDraft]);

  const remove = useCallback(() => run(async () => {
    if (document === null) return null;

    await deleteDocument(document.number).unwrap();
    callbacks.onDeleted();

    return document;
  }, "Не удалось удалить документ"), [callbacks, deleteDocument, document, run]);

  return {
    type, setType,
    warehouseId, setWarehouseId,
    comment, setComment,
    lines, addVariants, removeLine, setQuantity, setPrice,
    totalTiyn, totalQuantity,
    postOnSave, setPostOnSave,
    commentError,
    isEnter, isPosted, readOnly, canPost, isDirty,
    error,
    save, remove,
    isSaving: createState.isLoading || updateState.isLoading,
    isDeleting: deleteState.isLoading,
  };
}
