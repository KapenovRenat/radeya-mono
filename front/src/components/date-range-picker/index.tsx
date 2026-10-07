"use client";

import { useEffect, useState, type ComponentPropsWithoutRef } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { useAnchoredPanel } from "@/lib/use-anchored-panel";
import { cn } from "@/lib/utils";
import {
  WEEKDAYS,
  addMonths,
  buildMonthGrid,
  formatDay,
  formatFullDay,
  formatMonth,
  fromIso,
  isBetween,
  isSameDay,
  orderRange,
  startOfMonth,
  toIso,
  type IsoDate,
} from "./calendar";
import styles from "./style.module.scss";

/** Границы периода в формате `YYYY-MM-DD`. null — граница не задана. */
export interface DateRange {
  from: IsoDate | null;
  to: IsoDate | null;
}

export interface DateRangePickerProps
  extends Omit<ComponentPropsWithoutRef<"div">, "onChange" | "children"> {
  value: DateRange;
  onChange: (range: DateRange) => void;
  /** Подпись над кнопкой. */
  label?: string;
  /** Крайние даты, за которые нельзя выйти, `YYYY-MM-DD`. */
  min?: IsoDate;
  max?: IsoDate;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Выбор периода календарём.
 *
 * Период выбирается двумя кликами: первый ставит начало и сбрасывает конец,
 * второй — конец. Клик «назад» не ломает период: границы переставляются
 * местами. Пока конец не выбран, под курсором показывается предварительный
 * диапазон — иначе непонятно, что именно попадёт в выборку.
 *
 * Месяц листается отдельно от выбора, поэтому начало можно взять в прошлом
 * году, а конец — сегодня: это и есть обычный случай для заказов.
 *
 * Выбранное применяется только по «Применить». Пока панель открыта, правки
 * живут в черновике: случайный клик по дате не должен перезагружать таблицу.
 */
export function DateRangePicker({ value, onChange, label, min, max,
  disabled = false, placeholder = "Выберите период", className, ...props }: DateRangePickerProps) {
  const panel = useAnchoredPanel("start");
  const [draft, setDraft] = useState<DateRange>(value);
  const [hovered, setHovered] = useState<Date | null>(null);
  const [view, setView] = useState<Date>(() => startOfMonth(fromIso(value.from) ?? new Date()));

  // Открыли панель — начинаем с того, что показано снаружи. Иначе прошлый
  // недовыбранный черновик всплывёт при следующем открытии.
  useEffect(() => {
    if (!panel.isOpen) return;

    setDraft(value);
    setHovered(null);
    setView(startOfMonth(fromIso(value.from) ?? new Date()));
  }, [panel.isOpen, value]);

  const draftFrom = fromIso(draft.from);
  const draftTo = fromIso(draft.to);
  const minDate = fromIso(min ?? null);
  const maxDate = fromIso(max ?? null);
  const today = new Date();

  // Пока конец не выбран, диапазон дорисовывается по курсору.
  const previewTo = draftTo ?? (draftFrom && hovered ? hovered : null);
  const preview = draftFrom && previewTo ? orderRange(draftFrom, previewTo) : null;

  const isDisabled = (day: Date) =>
    (minDate !== null && day.getTime() < minDate.getTime())
    || (maxDate !== null && day.getTime() > maxDate.getTime());

  const pick = (day: Date) => {
    if (isDisabled(day)) return;

    // Начало уже есть и конца нет — вторым кликом закрываем период.
    if (draftFrom !== null && draftTo === null) {
      const range = orderRange(draftFrom, day);

      setDraft({ from: toIso(range.from), to: toIso(range.to) });
      setHovered(null);

      return;
    }

    setDraft({ from: toIso(day), to: null });
    setHovered(null);
  };

  const apply = () => {
    onChange(draft);
    panel.close(true);
  };

  const trigger = draft.from === null && draft.to === null
    ? placeholder
    : [value.from, value.to].map((iso) => {
      const date = fromIso(iso);

      return date === null ? "…" : formatDay(date);
    }).join(" — ");

  return (
    <div {...props} ref={panel.anchorRef} className={cn(styles.picker, className)}>
      {label && <span className={styles.label}>{label}</span>}

      <button
        type="button"
        className={styles.trigger}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={panel.isOpen}
        onClick={panel.toggle}
      >
        <CalendarDays size={16} aria-hidden="true" />
        <span className={cn(value.from === null && value.to === null && styles.muted)}>
          {value.from === null && value.to === null ? placeholder : trigger}
        </span>
      </button>

      {panel.isOpen && panel.container && createPortal(
        <div
          ref={panel.panelRef}
          role="dialog"
          aria-label={label ?? "Выбор периода"}
          // Пока положение не посчитано, панель невидима: иначе она на кадр
          // мигнёт в левом верхнем углу экрана.
          style={{ top: panel.position?.top ?? 0, left: panel.position?.left ?? 0,
            visibility: panel.position ? "visible" : "hidden" }}
          className={styles.panel}
        >
          <div className={styles.header}>
            <button type="button" className={styles.nav} aria-label="Предыдущий месяц"
              onClick={() => setView((current) => addMonths(current, -1))}>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>

            <span className={styles.month} aria-live="polite">{formatMonth(view)}</span>

            <button type="button" className={styles.nav} aria-label="Следующий месяц"
              onClick={() => setView((current) => addMonths(current, 1))}>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>

          <div className={styles.weekdays} aria-hidden="true">
            {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
          </div>

          <div className={styles.grid} onMouseLeave={() => setHovered(null)}>
            {buildMonthGrid(view).map((week) => week.map((day) => {
              const outside = day.getMonth() !== view.getMonth();
              const isFrom = draftFrom !== null && isSameDay(day, draftFrom);
              const isTo = preview !== null && isSameDay(day, preview.to);
              const inRange = preview !== null
                && isBetween(day, preview.from, preview.to);
              const edge = isFrom || isTo;

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={isDisabled(day)}
                  aria-label={formatFullDay(day)}
                  aria-pressed={edge}
                  onMouseEnter={() => setHovered(day)}
                  onFocus={() => setHovered(day)}
                  onClick={() => pick(day)}
                  className={cn(
                    styles.day,
                    outside && styles.outside,
                    inRange && styles.inRange,
                    edge && styles.edge,
                    // Края диапазона скругляются с одной стороны, чтобы полоса
                    // между ними читалась как единый период.
                    isFrom && preview !== null && !isSameDay(day, preview.to) && styles.edgeStart,
                    isTo && preview !== null && !isSameDay(day, preview.from) && styles.edgeEnd,
                    isSameDay(day, today) && styles.today,
                  )}
                >
                  {day.getDate()}
                </button>
              );
            }))}
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.clear}
              onClick={() => { setDraft({ from: null, to: null }); setHovered(null); }}>
              Сбросить
            </button>

            {/* Незакрытый период не применяем: одна выбранная дата — это
                ещё не диапазон, и что показывать по ней, непонятно. */}
            <button type="button" className={styles.apply}
              disabled={draft.from !== null && draft.to === null}
              onClick={apply}>
              Применить
            </button>
          </div>
        </div>,
        panel.container,
      )}
    </div>
  );
}
