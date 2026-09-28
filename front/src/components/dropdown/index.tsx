"use client";

import { useEffect, useId, useMemo, useState,
  type ComponentPropsWithoutRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, MoreVertical } from "lucide-react";

import { useAnchoredPanel } from "@/lib/use-anchored-panel";
import { cn } from "@/lib/utils";
import styles from "./style.module.scss";

export interface DropdownItem {
  /** Подпись пункта. Используется и как ключ списка, поэтому в одном меню не повторяется. */
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  /** Опасное действие — удаление. Красится в цвет предупреждения. */
  danger?: boolean;
}

/** Значение на выбор в режиме `select`. */
export interface DropdownOption {
  value: string;
  label: string;
  /**
   * Приглушённая пометка справа от названия: «(закрыто)», «(архив)».
   *
   * Отдельным полем, а не частью `label`: по `label` идёт поиск, и пометка
   * в нём означала бы, что «закрыто» находит половину списка.
   */
  note?: string;
  disabled?: boolean;
}

export interface DropdownProps
  extends Omit<ComponentPropsWithoutRef<"div">, "children" | "onChange"> {
  /**
   * Что делает компонент.
   *
   * `menu` — меню действий: пункты в `items`, выбор что-то запускает.
   * `select` — выбор значения: варианты в `options`, выбранное показано
   * на кнопке и возвращается через `onChange`.
   *
   * По умолчанию `menu`, чтобы места вызова, написанные до появления режимов,
   * продолжали работать без правок.
   */
  mode?: "menu" | "select";

  /** Пункты-действия. Режим `menu`. */
  items?: DropdownItem[];

  /** Варианты на выбор. Режим `select`. */
  options?: DropdownOption[];
  value?: string;
  onChange?: (value: string) => void;
  /** Что на кнопке, когда ничего не выбрано. */
  placeholder?: string;

  /**
   * Поле поиска над списком.
   *
   * Переключателем, а не автоматически по длине списка: порог «больше десяти —
   * показываем поиск» означал бы, что интерфейс меняется сам по себе, когда
   * в справочник добавили одиннадцатое значение.
   */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Что показать, когда поиск ничего не нашёл. */
  emptyLabel?: string;

  /** Содержимое кнопки. По умолчанию — три точки в `menu`, выбранное в `select`. */
  trigger?: ReactNode;
  /** Подпись кнопки для скринридера: «три точки» сами по себе ничего не говорят. */
  label?: string;
  /** С какой стороны кнопки открывается список. */
  align?: "start" | "end";
  disabled?: boolean;
}

/**
 * Базовое выпадающее меню и выбор значения.
 *
 * Своё, а не из UI-кита: китов в проекте нет по решению из STATUS.md.
 * Нативный `<select>` заменён им же намеренно — в него нельзя добавить ни поиск,
 * ни пометку «закрыто», ни кнопку «добавить значение», а четыре справочника
 * по несколько десятков строк без поиска листать невозможно.
 *
 * Портал, положение, клик вне и Escape — в общем хуке `useAnchoredPanel`:
 * тем же занят календарь выбора периода, и копия этой логики разъехалась бы
 * с оригиналом на первой же правке.
 */
export function Dropdown({
  mode = "menu",
  items = [],
  options = [],
  value,
  onChange,
  placeholder = "Не выбрано",
  searchable = false,
  searchPlaceholder = "Поиск",
  emptyLabel = "Ничего не найдено",
  trigger,
  label = mode === "select" ? "Выбор значения" : "Действия",
  // В режиме выбора список равняется по левому краю кнопки: он шире её,
  // и выравнивание по правому уводило бы его влево от поля.
  align = mode === "select" ? "start" : "end",
  disabled = false,
  className,
  ...props
}: DropdownProps) {
  const panel = useAnchoredPanel(align);
  const listId = useId();
  const { isOpen, panelRef: list, close } = panel;

  const [search, setSearch] = useState("");

  // Поиск живёт только пока список открыт: вернувшись к нему через минуту,
  // человек ждёт полный список, а не остатки прошлого запроса.
  useEffect(() => {
    if (!isOpen) setSearch("");
  }, [isOpen]);

  const query = search.trim().toLowerCase();

  const shownItems = useMemo(
    () => (query === "" ? items : items.filter((item) => item.label.toLowerCase().includes(query))),
    [items, query],
  );

  const shownOptions = useMemo(
    () => (query === "" ? options : options.filter((item) => item.label.toLowerCase().includes(query))),
    [options, query],
  );

  const isEmpty = mode === "select" ? shownOptions.length === 0 : shownItems.length === 0;
  const selected = options.find((option) => option.value === value);

  // Фокус на первый доступный элемент: с клавиатуры список бесполезен без этого.
  // При включённом поиске — на поле ввода: человек открыл его, чтобы печатать.
  useEffect(() => {
    if (!isOpen) return;

    const root = list.current;

    if (searchable) root?.querySelector<HTMLInputElement>("input")?.focus();
    else root?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [isOpen, list, searchable]);

  const moveFocus = (from: HTMLElement, step: 1 | -1) => {
    const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];

    if (buttons.length === 0) return;

    // Из поля поиска стрелка вниз ведёт на первый вариант, вверх — на последний.
    if (from.tagName === "INPUT") {
      (step === 1 ? buttons[0] : buttons[buttons.length - 1])?.focus();

      return;
    }

    const index = buttons.indexOf(from as HTMLButtonElement);

    // По кругу: с последнего пункта вниз попадаем на первый.
    buttons[(index + step + buttons.length) % buttons.length]?.focus();
  };

  return (
    <div
      ref={panel.anchorRef}
      className={cn(styles.dropdown, mode === "select" && styles.dropdownSelect, className)}
      {...props}
    >
      <button
        type="button"
        className={cn(styles.trigger, mode === "select" && styles.triggerSelect)}
        disabled={disabled}
        aria-haspopup={mode === "select" ? "listbox" : "menu"}
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-label={label}
        title={mode === "select" ? (selected?.label ?? placeholder) : label}
        onClick={panel.toggle}
      >
        {trigger ?? (mode === "select"
          ? (
            <>
              <span className={cn(styles.triggerText, selected === undefined && styles.muted)}>
                {selected?.label ?? placeholder}
              </span>
              <ChevronDown size={16} aria-hidden="true" className={styles.chevron} />
            </>
          )
          : <MoreVertical size={16} aria-hidden="true" />)}
      </button>

      {isOpen && createPortal(
        <div
          ref={list}
          // Пока позиция не посчитана, список невидим: иначе он на кадр
          // мигнёт в левом верхнем углу экрана.
          style={{
            top: panel.position?.top ?? 0,
            left: panel.position?.left ?? 0,
            visibility: panel.position ? "visible" : "hidden",
            // Список не уже кнопки: поле шириной в четверть экрана и список
            // в одиннадцать сантиметров рядом выглядят как две разные вещи.
            minWidth: mode === "select"
              ? panel.anchorRef.current?.offsetWidth
              : undefined,
          }}
          className={styles.menu}
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();
            moveFocus(event.target as HTMLElement, event.key === "ArrowDown" ? 1 : -1);
          }}
        >
          {/* Поле именно `text`, а не `search`: в поле поиска браузер вешает
              на Escape свою очистку, и нажатие делало бы два дела сразу —
              чистило строку и закрывало список. */}
          {searchable && (
            <input
              type="text"
              className={styles.search}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          )}

          {/* Поле поиска стоит вне списка: внутри `role="listbox"` может лежать
              только `role="option"`, и скринридер объявил бы поле вариантом. */}
          <div
            id={listId}
            role={mode === "select" ? "listbox" : "menu"}
            aria-label={label}
            className={styles.list}
          >
            {isEmpty && <p className={styles.empty}>{emptyLabel}</p>}

            {mode === "select" && shownOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={cn(styles.item, option.value === value && styles.selected)}
                disabled={option.disabled}
                onClick={() => {
                  close();
                  onChange?.(option.value);
                }}
              >
                <span className={styles.check} aria-hidden="true">
                  {option.value === value && <Check size={14} />}
                </span>

                {option.label}
                {option.note !== undefined && <span className={styles.note}>{option.note}</span>}
              </button>
            ))}

            {mode === "menu" && shownItems.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={cn(styles.item, item.danger && styles.danger)}
                disabled={item.disabled}
                onClick={() => {
                  // Закрываем до действия: оно может перерисовать сам список
                  // пунктов, и тогда закрывать будет уже нечего.
                  close();
                  item.onSelect();
                }}
              >
                {item.icon && <span className={styles.icon} aria-hidden="true">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
