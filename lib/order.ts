export interface SortableItem {
  id: string;
  sortOrder: number;
}

export interface TaskItem extends SortableItem {
  categoryId: string;
  starred: boolean;
  done: boolean;
}

export function calculateOrderBetween(
  prevOrder: number | null | undefined,
  nextOrder: number | null | undefined,
  fallback = Date.now()
): number {
  if (prevOrder != null && nextOrder != null) {
    return (prevOrder + nextOrder) / 2;
  }
  if (prevOrder != null) {
    return prevOrder + 1000;
  }
  if (nextOrder != null) {
    return nextOrder - 1000;
  }
  return fallback;
}

export function needsRebalance(orders: number[]): boolean {
  if (orders.length < 2) return false;
  for (let i = 1; i < orders.length; i++) {
    const diff = Math.abs(orders[i] - orders[i - 1]);
    if (diff < 1e-6) {
      return true;
    }
  }
  return false;
}

export function rebalanceList<T extends SortableItem>(items: T[]): T[] {
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted.map((item, index) => ({
    ...item,
    sortOrder: (index + 1) * 1000,
  }));
}

export function computeTaskDropOrderAndStar({
  existingTasksInCat,
  dropIndex,
}: {
  existingTasksInCat: Array<{ id: string; sortOrder: number; starred: boolean }>;
  dropIndex: number;
}): { newOrder: number; newStarred: boolean } {
  // existingTasksInCat should be sorted by: (b.starred ? 1 : 0) - (a.starred ? 1 : 0) || a.sortOrder - b.sortOrder
  const others = [...existingTasksInCat].sort((a, b) => {
    const sa = a.starred ? 1 : 0;
    const sb = b.starred ? 1 : 0;
    return sb - sa || a.sortOrder - b.sortOrder;
  });

  // Drag rule: dropping a task directly before a starred task makes it starred;
  // dropping it after the last starred task unstars it.
  const targetNeighbor = others[dropIndex];
  const newStarred = Boolean(targetNeighbor && targetNeighbor.starred);

  // When computing the new sort_order, only look at neighbors in the same star group.
  const group = others.filter((t) => Boolean(t.starred) === newStarred);
  const groupIndex = others.slice(0, dropIndex).filter((t) => Boolean(t.starred) === newStarred).length;

  const prev = group[groupIndex - 1];
  const next = group[groupIndex];

  const prevOrder = prev ? prev.sortOrder : null;
  const nextOrder = next ? next.sortOrder : null;

  const newOrder = calculateOrderBetween(prevOrder, nextOrder);
  return { newOrder, newStarred };
}

export function computeCategoryDropOrder({
  categories,
  dropIndex,
}: {
  categories: Array<{ id: string; sortOrder: number }>;
  dropIndex: number;
}): number {
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const prev = sorted[dropIndex - 1];
  const next = sorted[dropIndex];

  return calculateOrderBetween(
    prev ? prev.sortOrder : null,
    next ? next.sortOrder : null
  );
}

// Auto-minimize and auto-expand logic
export function isCategoryAllDone(
  categoryId: string,
  tasks: Array<{ categoryId: string; done: boolean }>
): boolean {
  const catTasks = tasks.filter((t) => t.categoryId === categoryId);
  return catTasks.length > 0 && catTasks.every((t) => t.done);
}

export function applyAutoMinimizeState({
  categoryId,
  tasks,
  collapsedMap,
  autoCollapsedMap,
}: {
  categoryId: string;
  tasks: Array<{ categoryId: string; done: boolean }>;
  collapsedMap: Record<string, boolean>;
  autoCollapsedMap: Record<string, boolean>;
}): {
  collapsedMap: Record<string, boolean>;
  autoCollapsedMap: Record<string, boolean>;
  didAutoCollapse: boolean;
} {
  const newCollapsed = { ...collapsedMap };
  const newAuto = { ...autoCollapsedMap };

  if (isCategoryAllDone(categoryId, tasks) && !newCollapsed[categoryId]) {
    newCollapsed[categoryId] = true;
    newAuto[categoryId] = true;
    return { collapsedMap: newCollapsed, autoCollapsedMap: newAuto, didAutoCollapse: true };
  }

  return { collapsedMap: newCollapsed, autoCollapsedMap: newAuto, didAutoCollapse: false };
}

export function applyAutoExpandState({
  categories,
  tasks,
  collapsedMap,
  autoCollapsedMap,
}: {
  categories: Array<{ id: string }>;
  tasks: Array<{ categoryId: string; done: boolean }>;
  collapsedMap: Record<string, boolean>;
  autoCollapsedMap: Record<string, boolean>;
}): {
  collapsedMap: Record<string, boolean>;
  autoCollapsedMap: Record<string, boolean>;
  changed: boolean;
} {
  const newCollapsed = { ...collapsedMap };
  const newAuto = { ...autoCollapsedMap };
  let changed = false;

  for (const cat of categories) {
    if (newAuto[cat.id] && !isCategoryAllDone(cat.id, tasks)) {
      newAuto[cat.id] = false;
      newCollapsed[cat.id] = false;
      changed = true;
    }
  }

  return { collapsedMap: newCollapsed, autoCollapsedMap: newAuto, changed };
}

export function applyManualToggle({
  categoryId,
  collapsedMap,
  autoCollapsedMap,
}: {
  categoryId: string;
  collapsedMap: Record<string, boolean>;
  autoCollapsedMap: Record<string, boolean>;
}): {
  collapsedMap: Record<string, boolean>;
  autoCollapsedMap: Record<string, boolean>;
} {
  const newCollapsed = { ...collapsedMap };
  const newAuto = { ...autoCollapsedMap };

  newCollapsed[categoryId] = !newCollapsed[categoryId];
  newAuto[categoryId] = false; // Tapping header clears auto flag

  return { collapsedMap: newCollapsed, autoCollapsedMap: newAuto };
}
