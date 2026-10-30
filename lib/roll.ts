import { weekKey } from "./time";

export interface CategorySummary {
  id: string;
  name: string;
  sortOrder: number;
}

export interface TaskRecord {
  id: string;
  text: string;
  done: boolean;
  categoryId: string;
  sortOrder: number;
  checkedAt?: Date | null;
  dueTime: string;
  starred: boolean;
}

export interface RollInput {
  currentWeek: string;
  startedAt: Date | null;
  tasks: TaskRecord[];
  categories: CategorySummary[];
  now?: Date | number;
  timeZone?: string;
}

export interface RollResult {
  rolled: boolean;
  newWeek: string;
  newStartedAt: Date;
  archiveEntry?: {
    week: string;
    done: number;
    total: number;
    savedAt: Date;
    detail: Array<{ n: string; d: number; t: number }>;
  };
  tasksToUpdate: Array<{ id: string; done: boolean; checkedAt: null }>;
}

export function executeRollWeek({
  currentWeek,
  startedAt,
  tasks,
  categories,
  now = Date.now(),
  timeZone = "America/Chicago",
}: RollInput): RollResult {
  const targetWeek = weekKey(now, timeZone);
  const nowDate = typeof now === "number" ? new Date(now) : now;

  // If already on the target week, do nothing (idempotent)
  if (currentWeek === targetWeek) {
    return {
      rolled: false,
      newWeek: currentWeek,
      newStartedAt: startedAt || nowDate,
      tasksToUpdate: [],
    };
  }

  // Check if at least one task was done in the previous week
  const doneCount = tasks.filter((t) => t.done).length;
  let archiveEntry: RollResult["archiveEntry"] | undefined = undefined;

  if (doneCount > 0 && currentWeek) {
    // Sort categories by sortOrder
    const sortedCats = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const detail: Array<{ n: string; d: number; t: number }> = [];

    for (const cat of sortedCats) {
      const catTasks = tasks.filter((t) => t.categoryId === cat.id);
      if (catTasks.length > 0) {
        detail.push({
          n: cat.name,
          d: catTasks.filter((t) => t.done).length,
          t: catTasks.length,
        });
      }
    }

    archiveEntry = {
      week: currentWeek,
      done: doneCount,
      total: tasks.length,
      savedAt: nowDate,
      detail,
    };
  }

  // Uncheck tasks
  const tasksToUpdate = tasks.map((t) => ({
    id: t.id,
    done: false,
    checkedAt: null,
  }));

  return {
    rolled: true,
    newWeek: targetWeek,
    newStartedAt: nowDate,
    archiveEntry,
    tasksToUpdate,
  };
}
