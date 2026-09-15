"use client";

import { useCallback, useState, type ChangeEvent } from "react";
import type { KaspiCatalogPreview } from "@radeya/shared";

import { apiErrorMessage } from "@/shared/api/error-message";
import { usePreviewKaspiCatalogMutation } from "./kaspi-catalog-api";

type FileSlot = "active" | "archive";

/**
 * Синхронизация каталога Kaspi из выгрузок кабинета.
 *
 * Файлы читаются в браузере и уходят на сервер текстом. Так не нужен разбор
 * multipart на сервере ради двух текстовых файлов, а лимит тела поднят
 * только на этом маршруте.
 */
export function useKaspiCatalogSync() {
  const [files, setFiles] = useState<Record<FileSlot, File | null>>({
    active: null,
    archive: null,
  });
  const [preview, setPreview] = useState<KaspiCatalogPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runPreview, { isLoading }] = usePreviewKaspiCatalogMutation();

  const selectFile = useCallback(
    (slot: FileSlot) => (event: ChangeEvent<HTMLInputElement>) => {
      setFiles((current) => ({
        ...current,
        [slot]: event.target.files?.[0] ?? null,
      }));
      setError(null);
    },
    [],
  );

  const canSync = Boolean(files.active || files.archive) && !isLoading;

  const sync = useCallback(async () => {
    setError(null);

    try {
      const [active, archive] = await Promise.all([
        readFile(files.active),
        readFile(files.archive),
      ]);

      setPreview(await runPreview({ active, archive }).unwrap());
    } catch (requestError) {
      setPreview(null);
      setError(apiErrorMessage(requestError, "Не удалось разобрать выгрузку"));
    }
  }, [files, runPreview]);

  const reset = useCallback(() => {
    setFiles({ active: null, archive: null });
    setPreview(null);
    setError(null);
  }, []);

  return { files, selectFile, sync, reset, canSync, isLoading, preview, error };
}

function readFile(file: File | null): Promise<string | undefined> {
  if (!file) return Promise.resolve(undefined);

  return file.text();
}
