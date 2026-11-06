"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import useSWR from "swr";
import { Header } from "@/components/Header";
import { ProgressCard } from "@/components/ProgressCard";
import { Category, CategoryData } from "@/components/Category";
import { TaskData } from "@/components/TaskRow";
import { AppearanceCard } from "@/components/AppearanceCard";
import { PastWeeks, WeekHistoryItem } from "@/components/PastWeeks";
import { Fab } from "@/components/Fab";
import { Dialog } from "@/components/Dialog";
import { Snackbar, SnackbarState } from "@/components/Snackbar";
import {
  formatWeekSubtitle,
  isOverdue,
  weekKey,
} from "@/lib/time";
import {
  applyAutoMinimizeState,
  applyAutoExpandState,
  applyManualToggle,
  computeCategoryDropOrder,
} from "@/lib/order";
import {
  THEME_STORAGE_KEY,
  ThemeConfig,
  applyTheme,
} from "@/lib/theme";
import { handleGripPointerDown } from "@/lib/dnd";
import Link from "next/link";

const COLLAPSED_STORAGE_KEY = "church-tech-collapsed-v1";

interface AppStateData {
  id: number;
  currentWeek: string;
  startedAt: string | null;
}

interface FullStateResponse {
  categories: CategoryData[];
  tasks: TaskData[];
  history: WeekHistoryItem[];
  appState: AppStateData;
  config: {
    timezone: string;
  };
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch state: ${res.statusText}`);
  }
  return res.json();
};

export default function ChecklistPage() {
  const { data, error, mutate } = useSWR<FullStateResponse>(
    "/api/state",
    fetcher,
    {
      refreshInterval: 10000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      keepPreviousData: true,
    }
  );

  // Client localStorage state
  const [theme, setTheme] = useState<ThemeConfig>({});
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
  const [autoCollapsedMap, setAutoCollapsedMap] = useState<Record<string, boolean>>({});
  const collapsedMapRef = useRef(collapsedMap);
  const autoCollapsedMapRef = useRef(autoCollapsedMap);

  // UI state
  const [newTaskText, setNewTaskText] = useState("");
  const [selectedCatId, setSelectedCatId] = useState("general");
  const [newCatName, setNewCatName] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: "",
  });
  const [isSoftHiddenBanner, setIsSoftHiddenBanner] = useState(false);
  const [rotationWrapperStyle, setRotationWrapperStyle] = useState<React.CSSProperties>({});

  const newTaskInputRef = useRef<HTMLInputElement>(null);
  const newCatInputRef = useRef<HTMLInputElement>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    collapsedMapRef.current = collapsedMap;
  }, [collapsedMap]);

  useEffect(() => {
    autoCollapsedMapRef.current = autoCollapsedMap;
  }, [autoCollapsedMap]);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const savedTheme = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || "{}");
      setTheme(savedTheme);
      applyTheme(savedTheme);

      const savedColl = JSON.parse(localStorage.getItem(COLLAPSED_STORAGE_KEY) || "{}");
      const collState: Record<string, boolean> = {};
      const autoCollState: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(savedColl)) {
        if (k.startsWith("a")) {
          autoCollState[k.slice(1)] = Boolean(v);
        } else {
          collState[k] = Boolean(v);
        }
      }
      setCollapsedMap(collState);
      setAutoCollapsedMap(autoCollState);
    } catch {}
  }, []);

  const saveCollapsed = (
    cMap: Record<string, boolean>,
    aMap: Record<string, boolean>
  ) => {
    try {
      const combined: Record<string, boolean> = { ...cMap };
      for (const [k, v] of Object.entries(aMap)) {
        combined["a" + k] = v;
      }
      localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(combined));
    } catch {}
  };

  const showToast = useCallback((message: string, onUndo?: () => void) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setSnackbar({ open: true, message, onUndo });
    toastTimeoutRef.current = setTimeout(() => {
      setSnackbar((prev) => ({ ...prev, open: false }));
    }, 6000);
  }, []);

  // Handle Rotation Lock Simulation
  useEffect(() => {
    const handleLayoutRotation = () => {
      const coarse =
        (typeof window !== "undefined" &&
          window.matchMedia &&
          window.matchMedia("(pointer: coarse)").matches) ||
        (typeof navigator !== "undefined" && (navigator.maxTouchPoints || 0) > 0);

      const w = window.innerWidth;
      const h = window.innerHeight;

      function getAngle(): number {
        const so = window.screen && window.screen.orientation;
        let a: number | null = null;
        if (so && typeof so.angle === "number") a = so.angle;
        if (
          (a === null || a === 0) &&
          typeof (window as any).orientation === "number" &&
          (window as any).orientation
        ) {
          a = (window as any).orientation;
        }
        if (a === null) a = 0;
        a = ((a % 360) + 360) % 360;
        if (a === 0 || a === 180) {
          const t = so && so.type;
          if (t && String(t).startsWith("landscape")) {
            a = t === "landscape-secondary" ? 270 : 90;
          }
        }
        return a;
      }

      const angle = getAngle();
      const H = document.documentElement;
      let dir: "cw" | "ccw" | null = null;

      if (theme.rl && coarse && w > h) {
        dir = angle === 270 ? "cw" : "ccw";
      }

      H.classList.toggle("rotl", Boolean(dir));
      H.classList.toggle("ccw", dir === "ccw");
      H.classList.toggle("cw", dir === "cw");

      if (dir) {
        setRotationWrapperStyle({
          width: `${h}px`,
          height: `${w}px`,
        });
      } else {
        setRotationWrapperStyle({});
      }

      H.classList.toggle("nw", (dir ? h : w) <= 640);
    };

    handleLayoutRotation();
    window.addEventListener("resize", handleLayoutRotation);
    window.addEventListener("orientationchange", handleLayoutRotation);
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener("change", handleLayoutRotation);
    }

    return () => {
      window.removeEventListener("resize", handleLayoutRotation);
      window.removeEventListener("orientationchange", handleLayoutRotation);
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener("change", handleLayoutRotation);
      }
    };
  }, [theme.rl]);

  // Idempotent Week Check
  const checkWeekRoll = useCallback(async () => {
    try {
      const res = await fetch("/api/week/check", { method: "POST" });
      if (res.ok) {
        const result = await res.json();
        if (result.rolled) {
          mutate();
          showToast("New week! Last week's results are under Past weeks.");
        }
      }
    } catch {}
  }, [mutate, showToast]);

  useEffect(() => {
    checkWeekRoll();
    const interval = setInterval(checkWeekRoll, 30000);
    const onFocus = () => checkWeekRoll();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [checkWeekRoll]);

  const categories = data?.categories || [];
  const tasks = data?.tasks || [];
  const history = data?.history || [];
  const timezone = data?.config?.timezone || "America/Chicago";
  const appStateData = data?.appState;

  const currentMonday = appStateData?.currentWeek || weekKey(Date.now(), timezone);
  const startedAt = appStateData?.startedAt ? new Date(appStateData.startedAt) : null;

  // Auto-expand categories if tasks became undone
  useEffect(() => {
    if (categories.length > 0 && tasks.length > 0) {
      const {
        collapsedMap: newC,
        autoCollapsedMap: newA,
        changed,
      } = applyAutoExpandState({
        categories,
        tasks,
        collapsedMap,
        autoCollapsedMap,
      });
      if (changed) {
        setCollapsedMap(newC);
        setAutoCollapsedMap(newA);
        saveCollapsed(newC, newA);
      }
    }
  }, [tasks, categories, collapsedMap, autoCollapsedMap]);

  // Overdue calculation
  const overdueTaskIds = new Set<string>();
  const overdueTasks: Array<{ id: string; text: string }> = [];

  const catMap = new Map<string, CategoryData>();
  categories.forEach((c) => catMap.set(c.id, c));

  for (const t of tasks) {
    const cat = catMap.get(t.categoryId);
    const isLate = isOverdue({
      done: t.done,
      taskDueTime: t.dueTime,
      categoryDueTime: cat?.dueTime,
      categoryDueDay: cat?.dueDay,
      now: Date.now(),
      startedAt,
      currentWeekMonday: currentMonday,
      timeZone: timezone,
    });
    if (isLate) {
      overdueTaskIds.add(t.id);
      overdueTasks.push({ id: t.id, text: t.text });
    }
  }

  // Count done
  const doneCount = tasks.filter((t) => t.done).length;
  const totalCount = tasks.length;

  const allCollapsed =
    categories.length > 0 && categories.every((c) => collapsedMap[c.id]);

  const handleToggleCollapseAll = () => {
    const nextState = !allCollapsed;
    const newMap: Record<string, boolean> = {};
    const newAuto: Record<string, boolean> = {};
    categories.forEach((c) => {
      newMap[c.id] = nextState;
      newAuto[c.id] = false;
    });
    setCollapsedMap(newMap);
    setAutoCollapsedMap(newAuto);
    saveCollapsed(newMap, newAuto);
  };

  const handleToggleCategoryCollapse = (catId: string) => {
    const { collapsedMap: newC, autoCollapsedMap: newA } = applyManualToggle({
      categoryId: catId,
      collapsedMap,
      autoCollapsedMap,
    });
    setCollapsedMap(newC);
    setAutoCollapsedMap(newA);
    saveCollapsed(newC, newA);
  };

  // Toggle Task Done
  const handleToggleTaskDone = async (task: TaskData, checked: boolean) => {
    // If clearing last overdue task, soft-hide banner
    if (checked && overdueTaskIds.has(task.id) && overdueTaskIds.size === 1) {
      setIsSoftHiddenBanner(true);
    }

    const previousTasks = [...tasks];
    const updatedTasks = tasks.map((t) =>
      t.id === task.id
        ? {
            ...t,
            done: checked,
            checkedAt: checked ? new Date().toISOString() : null,
          }
        : t
    );

    // Optimistic update
    mutate(
      data ? { ...data, tasks: updatedTasks } : undefined,
      false
    );

    // Auto-minimize check
    if (checked) {
      setTimeout(() => {
        const result = applyAutoMinimizeState({
          categoryId: task.categoryId,
          tasks: updatedTasks,
          collapsedMap: collapsedMapRef.current,
          autoCollapsedMap: autoCollapsedMapRef.current,
        });

        if (result.didAutoCollapse) {
          collapsedMapRef.current = result.collapsedMap;
          autoCollapsedMapRef.current = result.autoCollapsedMap;
          setCollapsedMap(result.collapsedMap);
          setAutoCollapsedMap(result.autoCollapsedMap);
          saveCollapsed(result.collapsedMap, result.autoCollapsedMap);
        }
      }, 700);
    }

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: checked }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      setIsSoftHiddenBanner(false);
      mutate();
    } catch {
      // Rollback
      mutate(data ? { ...data, tasks: previousTasks } : undefined, false);
      showToast("Could not save. Check your connection and try again.");
      setIsSoftHiddenBanner(false);
    }
  };

  // Toggle Task Star
  const handleToggleTaskStar = async (task: TaskData) => {
    const nextStar = !task.starred;
    const previousTasks = [...tasks];
    const updatedTasks = tasks.map((t) =>
      t.id === task.id ? { ...t, starred: nextStar } : t
    );

    mutate(
      data ? { ...data, tasks: updatedTasks } : undefined,
      false
    );

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred: nextStar }),
      });
      if (!res.ok) throw new Error("Failed to star task");
      mutate();
    } catch {
      mutate(data ? { ...data, tasks: previousTasks } : undefined, false);
      showToast("Could not save. Check your connection and try again.");
    }
  };

  // Update Task Text / DueTime / Category
  const handleUpdateTask = async (
    task: TaskData,
    text: string,
    dueTime: string,
    newCategoryId?: string
  ) => {
    const previousTasks = [...tasks];
    const targetCatId =
      newCategoryId && newCategoryId !== task.categoryId
        ? newCategoryId
        : task.categoryId;
    const updatedTasks = tasks.map((t) =>
      t.id === task.id ? { ...t, text, dueTime, categoryId: targetCatId } : t
    );

    mutate(
      data ? { ...data, tasks: updatedTasks } : undefined,
      false
    );

    try {
      const payload: { text: string; dueTime: string; categoryId?: string } = {
        text,
        dueTime,
      };
      if (newCategoryId && newCategoryId !== task.categoryId) {
        payload.categoryId = newCategoryId;
      }
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update task");
      mutate();
    } catch {
      mutate(data ? { ...data, tasks: previousTasks } : undefined, false);
      showToast("Could not save. Check your connection and try again.");
    }
  };

  // Delete Task
  const handleDeleteTask = async (task: TaskData) => {
    const previousTasks = [...tasks];
    const updatedTasks = tasks.filter((t) => t.id !== task.id);

    mutate(
      data ? { ...data, tasks: updatedTasks } : undefined,
      false
    );

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete task");

      showToast("Task deleted", async () => {
        // Undo delete
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: task.text,
            categoryId: task.categoryId,
            dueTime: task.dueTime,
          }),
        });
        mutate();
      });
      mutate();
    } catch {
      mutate(data ? { ...data, tasks: previousTasks } : undefined, false);
      showToast("Could not save. Check your connection and try again.");
    }
  };

  // Reset Category
  const handleResetCategory = async (cat: CategoryData) => {
    const catTasks = tasks.filter((t) => t.categoryId === cat.id && t.done);
    if (catTasks.length === 0) {
      showToast(`Nothing is checked in ${cat.name}`);
      return;
    }

    const previousSnapshots = catTasks.map((t) => ({
      id: t.id,
      checkedAt: t.checkedAt,
    }));

    const taskIds = catTasks.map((t) => t.id);

    // Optimistic uncheck
    const updatedTasks = tasks.map((t) =>
      t.categoryId === cat.id ? { ...t, done: false, checkedAt: null } : t
    );
    mutate(data ? { ...data, tasks: updatedTasks } : undefined, false);

    try {
      const res = await fetch("/api/tasks/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: taskIds,
          patch: { done: false, checkedAt: null },
        }),
      });
      if (!res.ok) throw new Error("Failed to reset category");

      showToast(`${cat.name} reset`, async () => {
        // Undo reset: restore previous checked states
        for (const snap of previousSnapshots) {
          await fetch(`/api/tasks/${snap.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ done: true, checkedAt: snap.checkedAt }),
          });
        }
        mutate();
      });
      mutate();
    } catch {
      mutate();
      showToast("Could not save. Check your connection and try again.");
    }
  };

  // Update Category
  const handleUpdateCategory = async (
    name: string,
    dueTime: string,
    dueDay: number
  ) => {
    try {
      const res = await fetch(`/api/categories/${selectedCatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, dueTime, dueDay }),
      });
      if (!res.ok) throw new Error("Failed to update category");
      mutate();
    } catch {
      showToast("Could not save. Check your connection and try again.");
    }
  };

  // Delete Category
  const handleDeleteCategory = async (cat: CategoryData) => {
    if (cat.id === "general") return;

    try {
      const res = await fetch(`/api/categories/${cat.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete category");
      showToast(`Category "${cat.name}" deleted`);
      mutate();
    } catch {
      showToast("Could not save. Check your connection and try again.");
    }
  };

  // Add Task
  const handleAddTask = async () => {
    const trimmed = newTaskText.trim();
    if (!trimmed) {
      if (newTaskInputRef.current) {
        newTaskInputRef.current.classList.remove("shake");
        void newTaskInputRef.current.offsetWidth;
        newTaskInputRef.current.classList.add("shake");
        newTaskInputRef.current.focus();
      }
      return;
    }

    setNewTaskText("");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          categoryId: selectedCatId,
        }),
      });
      if (!res.ok) throw new Error("Failed to create task");
      mutate();
      newTaskInputRef.current?.focus();
    } catch {
      showToast("Could not save. Check your connection and try again.");
    }
  };

  // Add Category
  const handleAddCategory = async () => {
    const trimmed = newCatName.trim();
    if (!trimmed) {
      if (newCatInputRef.current) {
        newCatInputRef.current.classList.remove("shake");
        void newCatInputRef.current.offsetWidth;
        newCatInputRef.current.classList.add("shake");
        newCatInputRef.current.focus();
      }
      return;
    }

    setNewCatName("");
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error("Failed to create category");
      mutate();
    } catch {
      showToast("Could not save. Check your connection and try again.");
    }
  };

  // Start New Week
  const handleStartNewWeekClick = () => {
    const hasAnyChecked = tasks.some((t) => t.done);
    if (!hasAnyChecked) {
      showToast("Nothing is checked yet, so there is nothing to reset.");
      return;
    }
    setResetDialogOpen(true);
  };

  const handleConfirmStartNewWeek = async () => {
    setResetDialogOpen(false);
    try {
      const res = await fetch("/api/week/reset", { method: "POST" });
      if (!res.ok) throw new Error("Failed to reset week");
      const result = await res.json();

      mutate();

      showToast("New week started. Results saved.", async () => {
        // Undo new week: re-check exactly what was done
        if (result.previousDoneTasks) {
          for (const item of result.previousDoneTasks) {
            await fetch(`/api/tasks/${item.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                done: true,
                checkedAt: item.checkedAt,
              }),
            });
          }
          mutate();
        }
      });
    } catch {
      showToast("Could not save. Check your connection and try again.");
    }
  };

  // Renew Due Times
  const handleRenewDueTimes = async () => {
    try {
      const res = await fetch("/api/week/renew", { method: "POST" });
      if (!res.ok) throw new Error("Failed to renew due times");
      mutate();
      showToast("Due times renewed. Past-due alerts are back on.");
    } catch {
      showToast("Could not save. Check your connection and try again.");
    }
  };

  // Drag and Drop Handler
  const handleTaskDrop = async (
    taskId: string,
    targetCatId: string,
    newOrder: number,
    newStarred: boolean
  ) => {
    const updatedTasks = tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            categoryId: targetCatId,
            sortOrder: newOrder,
            starred: newStarred,
          }
        : t
    );

    mutate(data ? { ...data, tasks: updatedTasks } : undefined, false);

    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: targetCatId,
          sortOrder: newOrder,
          starred: newStarred,
        }),
      });
      mutate();
    } catch {
      mutate();
      showToast("Could not save. Check your connection and try again.");
    }
  };

  const handleCategoryDrop = async (catId: string, newOrder: number) => {
    const updatedCats = categories.map((c) =>
      c.id === catId ? { ...c, sortOrder: newOrder } : c
    );

    mutate(data ? { ...data, categories: updatedCats } : undefined, false);

    try {
      await fetch(`/api/categories/${catId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: newOrder }),
      });
      mutate();
    } catch {
      mutate();
      showToast("Could not save. Check your connection and try again.");
    }
  };

  const subtitle = formatWeekSubtitle(currentMonday);
  const isSynced = !error && Boolean(data);

  return (
    <div id="rot" style={rotationWrapperStyle}>
      <main>
        <Header
          subtitle={subtitle}
          isSynced={isSynced}
          statusText={isSynced ? "Synced" : "Offline, changes will retry"}
        />

        <ProgressCard
          doneCount={doneCount}
          totalCount={totalCount}
          allCollapsed={allCollapsed}
          onToggleCollapseAll={handleToggleCollapseAll}
          onStartNewWeek={handleStartNewWeekClick}
          overdueTasks={overdueTasks}
          isSoftHiddenBanner={isSoftHiddenBanner}
        />

        <div id="cats">
          {categories.length === 0 ? (
            <div className="empty">
              Welcome! Add a category below (for example, Sound or Sarah), then
              add your weekly tasks.
            </div>
          ) : (
            categories.map((cat, idx) => (
              <Category
                key={cat.id}
                category={cat}
                categories={categories}
                tasks={tasks.filter((t) => t.categoryId === cat.id)}
                timezone={timezone}
                isCollapsed={Boolean(collapsedMap[cat.id])}
                overdueTaskIds={overdueTaskIds}
                canMoveUp={idx > 0}
                canMoveDown={idx < categories.length - 1}
                onMoveUp={() => {
                  if (idx === 0) return;
                  const others = categories.filter((c) => c.id !== cat.id);
                  const newOrder = computeCategoryDropOrder({
                    categories: others,
                    dropIndex: idx - 1,
                  });
                  handleCategoryDrop(cat.id, newOrder);
                }}
                onMoveDown={() => {
                  if (idx >= categories.length - 1) return;
                  const others = categories.filter((c) => c.id !== cat.id);
                  const newOrder = computeCategoryDropOrder({
                    categories: others,
                    dropIndex: idx + 1,
                  });
                  handleCategoryDrop(cat.id, newOrder);
                }}
                onToggleCollapse={() => handleToggleCategoryCollapse(cat.id)}
                onResetCategory={() => handleResetCategory(cat)}
                onUpdateCategory={(name, dueTime, dueDay) => {
                  fetch(`/api/categories/${cat.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, dueTime, dueDay }),
                  }).then(() => mutate());
                }}
                onDeleteCategory={() => handleDeleteCategory(cat)}
                onToggleTaskDone={handleToggleTaskDone}
                onToggleTaskStar={handleToggleTaskStar}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDeleteTask}
                onGripPointerDown={(e, c) =>
                  handleGripPointerDown({
                    e,
                    rowOrSec: e.currentTarget.closest(".cat") as HTMLElement,
                    item: c,
                    type: "category",
                    categories,
                    tasks,
                    onTaskDrop: handleTaskDrop,
                    onCategoryDrop: handleCategoryDrop,
                    showToast,
                  })
                }
                onTaskGripPointerDown={(e, t) =>
                  handleGripPointerDown({
                    e,
                    rowOrSec: e.currentTarget.closest(".row") as HTMLElement,
                    item: t,
                    type: "task",
                    categories,
                    tasks,
                    onTaskDrop: handleTaskDrop,
                    onCategoryDrop: handleCategoryDrop,
                    showToast,
                  })
                }
              />
            ))
          )}
        </div>

        <section className="addcard">
          <h2>Add</h2>
          <form className="add" onSubmit={(e) => { e.preventDefault(); handleAddTask(); }}>
            <input
              ref={newTaskInputRef}
              id="newTask"
              type="text"
              placeholder="New task"
              aria-label="New task"
              autoComplete="off"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
            />
            <select
              id="catSel"
              aria-label="Category"
              value={selectedCatId}
              onChange={(e) => setSelectedCatId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              className="tonal"
              id="addBtn"
              type="button"
              onClick={handleAddTask}
            >
              Add task
            </button>
          </form>

          <form className="add" onSubmit={(e) => { e.preventDefault(); handleAddCategory(); }}>
            <input
              ref={newCatInputRef}
              id="newCat"
              type="text"
              placeholder="New category (for example, Sound or Sarah)"
              aria-label="New category"
              autoComplete="off"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
            />
            <button
              className="tonal"
              id="addCatBtn"
              type="button"
              onClick={handleAddCategory}
            >
              Add category
            </button>
          </form>
        </section>

        <AppearanceCard theme={theme} onThemeChange={setTheme} />

        <PastWeeks history={history} />

        <p className="fine">
          Starting a new week pauses past-due alerts until each task&apos;s next
          due time.{" "}
          <button type="button" id="renewBtn" onClick={handleRenewDueTimes}>
            Renew due times
          </button>{" "}
          turns them back on for this week. &middot;{" "}
          <Link href="/import">Import data</Link> &middot;{" "}
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
          >
            Log out
          </button>
        </p>
      </main>

      <Fab
        onClick={() => {
          const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          newTaskInputRef.current?.scrollIntoView({
            behavior: reduceMotion ? "auto" : "smooth",
            block: "center",
          });
          setTimeout(() => {
            newTaskInputRef.current?.focus();
          }, reduceMotion ? 0 : 350);
        }}
      />

      <Dialog
        open={resetDialogOpen}
        onConfirm={handleConfirmStartNewWeek}
        onCancel={() => setResetDialogOpen(false)}
      />

      <Snackbar
        state={snackbar}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
