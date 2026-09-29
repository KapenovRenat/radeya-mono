"use client";

import { useCallback, useRef, useState } from "react";
import type { CommitStockImportResponse, StockImportPreview } from "@radeya/shared";

import { apiErrorMessage } from "@/shared/api/error-message";
import {
  useCommitStockImportMutation,
  usePreviewStockImportMutation,
} from "./moysklad-api";

/**
 * Импорт остатков из отчёта «Остатки» МойСклада — один склад за раз.
 *
 * Склад выбирается раньше файла: в отчёте склада нет, и от выбора зависит,
 * что обнулится. Сменили склад при уже разобранном файле — файл разбирается
 * заново: список на обнуление у другого склада другой, и показывать старый нельзя.
 */
export function useMoyskladStockImport() {
  const [preview, { isLoading: isParsing }] = usePreviewStockImportMutation();
  const [commit, { isLoading: isWriting }] = useCommitStockImportMutation();

  const busy = useRef(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setPreview] = useState<StockImportPreview | null>(null);
  const [written, setWritten] = useState<CommitStockImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setWritten(null);
    setError(null);
  }, []);

  const parse = useCallback(async (next: File, warehouse: string, sheet?: string) => {
    busy.current = true;
    setWritten(null);
    setError(null);

    try {
      return await preview(sheet === undefined
        ? { file: next, warehouseId: warehouse }
        : { file: next, warehouseId: warehouse, sheet }).unwrap();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Не удалось разобрать файл"));

      return null;
    } finally {
      busy.current = false;
    }
  }, [preview]);

  /** Состав книги, и если лист один — сразу его разбор. */
  const load = useCallback(async (next: File, warehouse: string, sheet?: string) => {
    if (sheet !== undefined) {
      const parsed = await parse(next, warehouse, sheet);

      if (parsed !== null) setPreview(parsed);

      return;
    }

    const book = await parse(next, warehouse);

    if (book === null) return;

    const only = book.sheets.length === 1 ? book.sheets[0] : undefined;

    setPreview(only === undefined ? book : (await parse(next, warehouse, only)) ?? book);
  }, [parse]);

  const selectWarehouse = useCallback(async (next: string) => {
    if (busy.current) return;

    setWarehouseId(next);
    setPreview(null);
    setWritten(null);

    if (file !== null && next !== "") await load(file, next, result?.sheet ?? undefined);
  }, [file, load, result]);

  const selectFile = useCallback(async (next: File | null) => {
    if (busy.current) return;

    setFile(next);
    setPreview(null);
    setWritten(null);
    setError(null);

    if (next !== null && warehouseId !== "") await load(next, warehouseId);
  }, [load, warehouseId]);

  const selectSheet = useCallback(async (sheet: string) => {
    if (busy.current || file === null || warehouseId === "" || sheet === "") return;

    await load(file, warehouseId, sheet);
  }, [file, load, warehouseId]);

  /**
   * Запись. Склад и список на обнуление берутся из предпросмотра, а не из
   * текущего выбора: записывается ровно то, что человек увидел.
   */
  const write = useCallback(async () => {
    if (busy.current || result === null || result.sheet === null) return;

    busy.current = true;
    setError(null);

    try {
      setWritten(await commit({
        sheet: result.sheet,
        warehouseId: result.warehouse.id,
        stockAt: result.stockAt,
        rows: result.rows,
        zeroVariantIds: result.toZero.map((item) => item.variantId),
      }).unwrap());
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Не удалось записать остатки"));
    } finally {
      busy.current = false;
    }
  }, [commit, result]);

  const rows = result?.rows ?? [];

  return {
    warehouseId,
    file,
    preview: result,
    sheets: result?.sheets ?? [],
    rows,
    withProblems: rows.filter((row) => row.problems.length > 0).length,
    written,
    selectWarehouse,
    selectFile,
    selectSheet,
    write,
    reset,
    isParsing,
    isWriting,
    error,
  };
}
