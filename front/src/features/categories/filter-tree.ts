import type { CategoryTreeNode } from "@radeya/shared";

/** Сравнимый вид: регистр не важен, «ё» люди набирают как «е». */
const normalize = (value: string) => value.trim().toLowerCase().replace(/ё/g, "е");

export interface FilteredTree {
  items: CategoryTreeNode[];
  /** Родители найденных подпапок: их нужно раскрыть, иначе результат не виден. */
  expand: string[];
}

/**
 * Отбор папок по названию.
 *
 * Дерево приходит целиком одним запросом, поэтому фильтруем на клиенте:
 * запрос на сервер за двумя уровнями папок — лишний круг.
 *
 * Совпал родитель — показываем его со всеми детьми. Совпал ребёнок —
 * показываем родителя с подошедшими детьми и раскрываем его: иначе
 * найденное прячется внутри свёрнутой папки, и поиск выглядит сломанным.
 *
 * Общая функция, а не копия в каждом месте: дерево с поиском есть и в панели
 * категорий, и в модалке переноса товаров.
 */
export function filterTree(items: CategoryTreeNode[], search: string): FilteredTree {
  const query = normalize(search);
  if (query === "") return { items, expand: [] };

  const matched: CategoryTreeNode[] = [];
  const expand: string[] = [];

  for (const parent of items) {
    if (normalize(parent.name).includes(query)) {
      matched.push(parent);
      continue;
    }
    const children = parent.children.filter((child) => normalize(child.name).includes(query));
    if (children.length === 0) continue;
    matched.push({ ...parent, children });
    expand.push(parent.id);
  }

  return { items: matched, expand };
}
