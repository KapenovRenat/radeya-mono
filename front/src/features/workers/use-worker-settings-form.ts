"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  TELEGRAM_CHAT_ID_PATTERN,
  type UpdateWorkerSettingsRequest,
  type Weekday,
  type WorkerDto,
} from "@radeya/shared";

import { apiErrorMessage } from "@/shared/api/error-message";
import { useUpdateWorkerSettingsMutation } from "./workers-api";

/** В форме Telegram ID — строка поля ввода; null появляется только при отправке. */
type WorkerSettingsDraft = Omit<UpdateWorkerSettingsRequest, "devChatId"> & { devChatId: string };

/**
 * Форма настроек воркера. Изменения живут в черновике и уходят на сервер
 * только по «Сохранить»: воркер работает по сохранённому, а не по тому,
 * что сейчас натыкано в форме.
 *
 * Черновик `null` — показываем сохранённое с сервера. Так опрос состояния
 * раз в 15 секунд не затирает то, что человек начал менять.
 */
export function useWorkerSettingsForm(worker: WorkerDto) {
  const [updateSettings, { isLoading }] = useUpdateWorkerSettingsMutation();
  const saving = useRef(false);
  const [draft, setDraft] = useState<WorkerSettingsDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const saved = useMemo(() => toDraft(worker), [worker]);
  const value = draft ?? saved;
  const isDirty = draft !== null && !sameDraft(draft, saved);

  const set = useCallback(<K extends keyof WorkerSettingsDraft>(field: K, next: WorkerSettingsDraft[K]) => {
    setNotice(null);
    setDraft((current) => ({ ...(current ?? saved), [field]: next }));
  }, [saved]);

  const toggleWeekday = useCallback((day: Weekday) => {
    const days = value.supplierNotifyWeekdays;

    set("supplierNotifyWeekdays", days.includes(day)
      ? days.filter((item) => item !== day)
      : [...days, day].sort((a, b) => a - b));
  }, [set, value.supplierNotifyWeekdays]);

  const reset = useCallback(() => {
    setDraft(null);
    setError(null);
    setNotice(null);
  }, []);

  const save = useCallback(async () => {
    if (saving.current || draft === null) return;

    const devChatId = draft.devChatId.trim();

    if (devChatId !== "" && !TELEGRAM_CHAT_ID_PATTERN.test(devChatId)) {
      setError("Telegram ID — только цифры, у группы с минусом");

      return;
    }

    if (draft.devAlertsEnabled && devChatId === "") {
      setError("Для оповещений разработчику укажите Telegram ID");

      return;
    }

    if (draft.supplierNotifyEnabled && draft.supplierNotifyWeekdays.length === 0) {
      setError("Для отправки поставщикам выберите хотя бы один день");

      return;
    }

    saving.current = true;
    setError(null);

    try {
      await updateSettings({
        key: worker.key,
        ...draft,
        devChatId: devChatId === "" ? null : devChatId,
      }).unwrap();

      setDraft(null);
      setNotice("Сохранено. Воркер применит настройки в течение 15 секунд");
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Не удалось сохранить настройки воркера"));
    } finally {
      saving.current = false;
    }
  }, [draft, updateSettings, worker.key]);

  return { value, set, toggleWeekday, isDirty, save, reset, isSaving: isLoading, error, notice };
}

function toDraft(worker: WorkerDto): WorkerSettingsDraft {
  const settings = worker.settings;

  return {
    enabled: settings.enabled,
    intervalMinutes: settings.intervalMinutes,
    periodMonths: settings.periodMonths,
    supplierNotifyEnabled: settings.supplierNotifyEnabled,
    supplierNotifyDelayMinutes: settings.supplierNotifyDelayMinutes,
    supplierNotifyWeekdays: settings.supplierNotifyWeekdays,
    devAlertsEnabled: settings.devAlertsEnabled,
    devChatId: settings.devChatId ?? "",
  };
}

function sameDraft(a: WorkerSettingsDraft, b: WorkerSettingsDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
