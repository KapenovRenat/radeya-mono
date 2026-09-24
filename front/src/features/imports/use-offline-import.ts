"use client";

import { useCallback, useRef, useState } from "react";
import type { CommitOfflineImportResponse, OfflineImportPreview } from "@radeya/shared";

import { apiErrorMessage } from "@/shared/api/error-message";
import { useCommitOfflineImportMutation, usePreviewOfflineImportMutation } from "./imports-api";

/**
 * Импорт продаж офлайн-точки.
 *
 * Три шага, и каждый следующий доступен только после предыдущего: файл → лист →
 * запись. Точка продаж выбирается когда угодно, но без неё записывать некуда.
 *
 * Файл держим в состоянии: разбор листа — это второй запрос с тем же файлом,
 * и заставлять человека выбирать его заново было бы издевательством.
 */
export function useOfflineImport() {
  const [preview, { isLoading: isParsing }] = usePreviewOfflineImportMutation();
  const [commit, { isLoading: isWriting }] = useCommitOfflineImportMutation();

  const busy = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [salesPointId, setSalesPointId] = useState("");
  const [result, setPreview] = useState<OfflineImportPreview | null>(null);
  const [written, setWritten] = useState<CommitOfflineImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setWritten(null);
    setError(null);
  }, []);

  /** Новый файл: разбираем без листа — сначала нужен перечень листов книги. */
  const selectFile = useCallback(async (next: File | null) => {
    if (busy.current) return;

    setFile(next);
    setPreview(null);
    setWritten(null);
    setError(null);

    if (next === null) return;

    busy.current = true;

    try {
      setPreview(await preview({ file: next }).unwrap());
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Не удалось прочитать файл"));
    } finally {
      busy.current = false;
    }
  }, [preview]);

  /** Выбран лист — разбираем его тем же файлом. */
  const selectSheet = useCallback(async (sheet: string) => {
    if (busy.current || file === null || sheet === "") return;

    busy.current = true;
    setWritten(null);
    setError(null);

    try {
      setPreview(await preview({ file, sheet }).unwrap());
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Не удалось разобрать лист"));
    } finally {
      busy.current = false;
    }
  }, [file, preview]);

  /**
   * Запись.
   *
   * Уходят те же строки, что человек увидел в предпросмотре, — включая
   * непригодные: сервер отсеет их сам и вернёт списком, а молча не отправить
   * часть строк значит показать одно, а записать другое.
   */
  const write = useCallback(async () => {
    if (busy.current || result === null || result.sheet === null) return;
    if (salesPointId === "") {
      setError("Выберите точку продаж");

      return;
    }

    busy.current = true;
    setError(null);

    try {
      setWritten(await commit({
        salesPointId,
        sheet: result.sheet,
        rows: result.rows,
      }).unwrap());
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Не удалось записать заказы"));
    } finally {
      busy.current = false;
    }
  }, [commit, result, salesPointId]);

  const rows = result?.rows ?? [];

  return {
    file,
    salesPointId,
    setSalesPointId,
    preview: result,
    sheets: result?.sheets ?? [],
    rows,
    /** Готовых к записи: у остальных нет даты или суммы. */
    ready: rows.length - (result?.invalid ?? 0),
    withProblems: rows.filter((row) => row.problems.length > 0).length,
    written,
    selectFile,
    selectSheet,
    write,
    reset,
    isParsing,
    isWriting,
    error,
  };
}
