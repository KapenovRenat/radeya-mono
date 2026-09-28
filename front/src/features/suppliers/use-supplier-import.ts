"use client";

import { useCallback, useRef, useState } from "react";
import type { CommitSupplierImportResponse, SupplierImportPreview } from "@radeya/shared";

import { apiErrorMessage } from "@/shared/api/error-message";
import {
  useCommitSupplierImportMutation,
  usePreviewSupplierImportMutation,
} from "./suppliers-api";

/**
 * Импорт поставщиков из выгрузки контрагентов МойСклада.
 *
 * Два шага: файл → запись. Лист выбирается только когда их в книге несколько;
 * в выгрузке контрагентов лист один, и заставлять человека выбирать его
 * из списка в одну строку — лишний клик на пустом месте.
 *
 * Файл держим в состоянии: разбор листа — это второй запрос с тем же файлом.
 */
export function useSupplierImport() {
  const [preview, { isLoading: isParsing }] = usePreviewSupplierImportMutation();
  const [commit, { isLoading: isWriting }] = useCommitSupplierImportMutation();

  const busy = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setPreview] = useState<SupplierImportPreview | null>(null);
  const [written, setWritten] = useState<CommitSupplierImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setWritten(null);
    setError(null);
  }, []);

  /** Разбор листа тем файлом, что уже выбран. */
  const parse = useCallback(async (next: File, sheet?: string) => {
    busy.current = true;
    setWritten(null);
    setError(null);

    try {
      return await preview(sheet === undefined ? { file: next } : { file: next, sheet }).unwrap();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Не удалось разобрать файл"));

      return null;
    } finally {
      busy.current = false;
    }
  }, [preview]);

  /**
   * Новый файл.
   *
   * Сначала узнаём состав книги, и если лист один — сразу его и разбираем:
   * выбор из одного варианта ничего не решает.
   */
  const selectFile = useCallback(async (next: File | null) => {
    if (busy.current) return;

    setFile(next);
    setPreview(null);
    setWritten(null);
    setError(null);

    if (next === null) return;

    const book = await parse(next);

    if (book === null) return;

    const only = book.sheets.length === 1 ? book.sheets[0] : undefined;

    if (only !== undefined) {
      setPreview((await parse(next, only)) ?? book);

      return;
    }

    setPreview(book);
  }, [parse]);

  const selectSheet = useCallback(async (sheet: string) => {
    if (busy.current || file === null || sheet === "") return;

    const parsed = await parse(file, sheet);

    if (parsed !== null) setPreview(parsed);
  }, [file, parse]);

  /**
   * Запись.
   *
   * Уходят те же строки, что человек увидел, — включая непригодные: сервер
   * отсеет их сам и вернёт списком. Отправить молча часть строк значит
   * показать одно, а записать другое.
   */
  const write = useCallback(async () => {
    if (busy.current || result === null || result.sheet === null) return;

    busy.current = true;
    setError(null);

    try {
      setWritten(await commit({ sheet: result.sheet, rows: result.rows }).unwrap());
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Не удалось записать поставщиков"));
    } finally {
      busy.current = false;
    }
  }, [commit, result]);

  const rows = result?.rows ?? [];

  return {
    file,
    preview: result,
    sheets: result?.sheets ?? [],
    rows,
    /** Готовых к записи: у остальных нет наименования или UUID. */
    ready: rows.length - (result?.invalid ?? 0),
    /** Из них новых — эти заведутся; остальные уже есть и продублированы не будут. */
    fresh: rows.filter((row) => !row.known && row.name !== null && row.externalId !== null).length,
    withDiffs: rows.filter((row) => row.diffs.length > 0).length,
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
