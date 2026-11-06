import { computeTaskDropOrderAndStar, computeCategoryDropOrder } from "./order";
import { TaskData } from "@/components/TaskRow";
import { CategoryData } from "@/components/Category";

export interface DragContext {
  isDragging: boolean;
  justDragged: boolean;
}

let justDragged = false;
let justDraggedTimer: any = null;

export function isJustDragged(): boolean {
  return justDragged;
}

function markJustDragged() {
  justDragged = true;
  clearTimeout(justDraggedTimer);
  justDraggedTimer = setTimeout(() => {
    justDragged = false;
  }, 220);
}

// Suppress accidental click events right after a drag completes
if (typeof window !== "undefined") {
  window.addEventListener(
    "click",
    (e) => {
      if (justDragged) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );
}

export function handleGripPointerDown({
  e,
  rowOrSec,
  item,
  type,
  categories,
  tasks,
  onTaskDrop,
  onCategoryDrop,
  showToast,
}: {
  e: React.PointerEvent<HTMLDivElement>;
  rowOrSec: HTMLElement;
  item: TaskData | CategoryData;
  type: "task" | "category";
  categories: CategoryData[];
  tasks: TaskData[];
  onTaskDrop: (taskId: string, targetCatId: string, newOrder: number, newStarred: boolean) => void;
  onCategoryDrop: (catId: string, newOrder: number) => void;
  showToast: (msg: string) => void;
}) {
  if (document.documentElement.classList.contains("rotl")) {
    showToast("Turn your device upright to reorder.");
    return;
  }

  const startFn = type === "task" ? startTaskDrag : startCategoryDrag;

  if (e.pointerType === "mouse") {
    startFn({
      e: e.nativeEvent,
      element: rowOrSec,
      item,
      categories,
      tasks,
      onTaskDrop,
      onCategoryDrop,
    });
    return;
  }

  // Mobile Touch / Pen:
  const targetEl = e.currentTarget as HTMLElement;
  const pid = e.pointerId;
  const sx = e.clientX;
  const sy = e.clientY;
  let lastEvent = e.nativeEvent;
  let started = false;

  try {
    targetEl.setPointerCapture?.(pid);
  } catch {}

  const triggerStart = (ev: PointerEvent) => {
    if (started) return;
    started = true;
    cleanupTouch();
    startFn({
      e: ev,
      element: rowOrSec,
      item,
      categories,
      tasks,
      onTaskDrop,
      onCategoryDrop,
    });
  };

  // Immediate tactile response: start drag as soon as finger moves >= 4px or after a brief 70ms hold
  const timer = setTimeout(() => {
    triggerStart(lastEvent);
  }, 70);

  function onPointerMove(ev: PointerEvent) {
    if (ev.pointerId !== pid) return;
    lastEvent = ev;
    const dx = ev.clientX - sx;
    const dy = ev.clientY - sy;
    if (Math.hypot(dx, dy) >= 4) {
      triggerStart(ev);
    }
  }

  function cleanupTouch() {
    clearTimeout(timer);
    try {
      targetEl.releasePointerCapture?.(pid);
    } catch {}
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", cleanupTouch);
  }

  function onPointerUp() {
    cleanupTouch();
  }

  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("pointerup", onPointerUp);
  document.addEventListener("pointercancel", cleanupTouch);
}

function startTaskDrag({
  e,
  element: row,
  item,
  categories,
  tasks,
  onTaskDrop,
}: {
  e: PointerEvent;
  element: HTMLElement;
  item: any;
  categories: CategoryData[];
  tasks: TaskData[];
  onTaskDrop: (taskId: string, targetCatId: string, newOrder: number, newStarred: boolean) => void;
  onCategoryDrop: (catId: string, newOrder: number) => void;
}) {
  if (e.button > 0) return;
  e.preventDefault();

  const task = item as TaskData;
  const catsContainer = document.getElementById("cats");
  const r = row.getBoundingClientRect();
  const offY = e.clientY - r.top;
  const offX = e.clientX - r.left;
  const startX = e.clientX;
  let cx = e.clientX;
  let cy = e.clientY;
  const pid = e.pointerId;
  let rafId: any = null;
  let autoExpandTimer: any = null;
  let hoveredCollapsedCatId: string | null = null;

  // Placeholder
  const ph = document.createElement("div");
  ph.className = "ph";
  ph.style.height = `${r.height}px`;

  // Insert placeholder where the row currently is
  const parentContainer = row.parentNode;
  parentContainer?.insertBefore(ph, row);

  // Lift the row
  row.style.width = `${r.width}px`;
  row.classList.add("lift");
  console.log("[dnd] startTaskDrag task:", task.id, "from cat:", task.categoryId, "offY:", offY);

  if (navigator.vibrate) {
    try {
      navigator.vibrate(20);
    } catch {}
  }

  function place() {
    // Keep row aligned with the list column, dampening horizontal drift on mobile
    const horizDrift = (cx - startX) * 0.15;
    row.style.top = `${cy - offY}px`;
    row.style.left = `${r.left + horizDrift}px`;

    if (!catsContainer) return;
    const currentCatsRect = catsContainer.getBoundingClientRect();

    // Clamp probeX and probeY to stay reliably within the viewport and cats column
    const probeX = Math.max(
      currentCatsRect.left + 24,
      Math.min(currentCatsRect.right - 24, cx)
    );
    const probeY = Math.max(10, Math.min(window.innerHeight - 10, cy));
    const target = document.elementFromPoint(probeX, probeY);
    if (!target || target.closest(".ph")) return;

    // Remove old hover highlights
    document.querySelectorAll(".over").forEach((x) => x.classList.remove("over"));

    const sec = target.closest<HTMLElement>("#cats .cat");
    if (sec) {
      sec.classList.add("over");

      // Auto-expand collapsed category when hovering task over it for 350ms
      if (sec.classList.contains("collapsed")) {
        const catId = sec.dataset.cat;
        if (catId && catId !== hoveredCollapsedCatId) {
          hoveredCollapsedCatId = catId;
          clearTimeout(autoExpandTimer);
          autoExpandTimer = setTimeout(() => {
            const togBtn = sec.querySelector<HTMLButtonElement>(".tog");
            togBtn?.click();
            if (navigator.vibrate) {
              try {
                navigator.vibrate(10);
              } catch {}
            }
          }, 350);
        }
      } else {
        hoveredCollapsedCatId = null;
        clearTimeout(autoExpandTimer);
      }
    } else {
      hoveredCollapsedCatId = null;
      clearTimeout(autoExpandTimer);
    }

    // Find the row and target container
    const r2 = target.closest<HTMLElement>(".row:not(.lift)");
    if (r2 && r2.parentElement) {
      const container = r2.parentElement;
      const b = r2.getBoundingClientRect();
      const dn = ph.compareDocumentPosition(r2) & 4;
      const f = (cy - b.top) / b.height;
      if (dn) {
        if (f > 0.35) container.insertBefore(ph, r2.nextSibling);
      } else {
        if (f < 0.65) container.insertBefore(ph, r2);
      }
    } else if (sec) {
      const inner =
        sec.querySelector<HTMLElement>(".catbody-inner") ||
        sec.querySelector<HTMLElement>(".catbody");
      if (inner) {
        if (target.closest(".cathead")) {
          inner.insertBefore(ph, inner.firstChild);
        } else {
          inner.appendChild(ph);
        }
      }
    }
  }

  function cleanup() {
    clearInterval(rafId);
    clearTimeout(autoExpandTimer);
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onCancel);
    document.querySelectorAll(".over").forEach((x) => x.classList.remove("over"));
  }

  function finish(commit: boolean) {
    markJustDragged();
    cleanup();
    row.classList.remove("lift");
    row.style.width = "";
    row.style.top = "";
    row.style.left = "";

    const parent = ph.parentElement;
    const catSec = ph.closest<HTMLElement>(".cat");
    const targetCatId = parent?.dataset.cat || catSec?.dataset.cat;
    console.log("[dnd] finish commit:", commit, "parent:", parent?.className, "targetCatId:", targetCatId);

    if (commit && parent && targetCatId) {
      const sibs = Array.from(parent.children).filter(
        (x) => x === ph || (x.classList.contains("row") && !x.classList.contains("lift"))
      );
      const k = sibs.indexOf(ph);

      // Existing tasks in the target category (excluding the dragged one)
      const otherTasks = tasks.filter((t) => t.categoryId === targetCatId && t.id !== task.id);
      const { newOrder, newStarred } = computeTaskDropOrderAndStar({
        existingTasksInCat: otherTasks,
        dropIndex: k >= 0 ? k : otherTasks.length,
      });

      if (navigator.vibrate) {
        try {
          navigator.vibrate(15);
        } catch {}
      }

      onTaskDrop(task.id, targetCatId, newOrder, newStarred);
    }

    if (ph.parentNode) {
      ph.parentNode.removeChild(ph);
    }
  }

  function onMove(ev: PointerEvent) {
    if (ev.pointerId !== pid) return;
    cx = ev.clientX;
    cy = ev.clientY;
    place();
  }

  function onUp(ev: PointerEvent) {
    if (ev.pointerId === pid) {
      cx = ev.clientX;
      cy = ev.clientY;
      place();
      finish(true);
    }
  }

  function onCancel() {
    finish(false);
  }

  document.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", onCancel);

  // Smooth proportional auto-scroll near screen edges
  rafId = setInterval(() => {
    const topZone = 90;
    const botZone = window.innerHeight - 90;
    if (cy < topZone) {
      const dist = Math.max(1, topZone - cy);
      const speed = Math.min(18, Math.max(3, (dist / topZone) * 18));
      window.scrollBy(0, -speed);
    } else if (cy > botZone) {
      const dist = Math.max(1, cy - botZone);
      const speed = Math.min(18, Math.max(3, (dist / 90) * 18));
      window.scrollBy(0, speed);
    }
    place();
  }, 16);

  place();
}

function startCategoryDrag({
  e,
  element: sec,
  item,
  categories,
  onCategoryDrop,
}: {
  e: PointerEvent;
  element: HTMLElement;
  item: any;
  categories: CategoryData[];
  tasks: TaskData[];
  onTaskDrop: (taskId: string, targetCatId: string, newOrder: number, newStarred: boolean) => void;
  onCategoryDrop: (catId: string, newOrder: number) => void;
}) {
  if (e.button > 0) return;
  e.preventDefault();

  const category = item as CategoryData;
  const root = document.getElementById("cats");
  if (!root) return;

  const catsRect = root.getBoundingClientRect();
  const grip = (sec.querySelector(".grip") as HTMLElement) || sec;
  const gripRect = grip.getBoundingClientRect();

  // Anchor relative to grip so the category never leaps vertically upon pickup
  const offX = e.clientX - gripRect.left;
  const offY = e.clientY - gripRect.top;
  let cx = e.clientX;
  let cy = e.clientY;
  const pid = e.pointerId;
  let rafId: any = null;

  root.classList.add("catdrag");

  const ph = document.createElement("div");
  ph.className = "ph cat-ph";
  ph.style.height = "56px";
  ph.style.margin = "12px 0";
  ph.style.borderRadius = "24px";
  root.insertBefore(ph, sec);

  sec.style.width = `${catsRect.width}px`;
  sec.classList.add("lift");

  if (navigator.vibrate) {
    try {
      navigator.vibrate(25);
    } catch {}
  }

  function place() {
    const curGrip = (sec.querySelector(".grip") as HTMLElement) || sec;
    const curGripOffsetTop = curGrip.offsetTop || 0;

    sec.style.top = `${cy - offY - curGripOffsetTop}px`;
    sec.style.left = `${catsRect.left}px`;

    const probeX = catsRect.left + catsRect.width / 2;
    const probeY = Math.max(10, Math.min(window.innerHeight - 10, cy));
    const target = document.elementFromPoint(probeX, probeY);
    if (!target || target.closest(".ph")) return;

    const s2 = target.closest<HTMLElement>("#cats > .cat:not(.lift)");
    if (s2) {
      const b = s2.getBoundingClientRect();
      const dn = ph.compareDocumentPosition(s2) & 4;
      const f = (cy - b.top) / b.height;
      if (dn) {
        if (f > 0.35) root?.insertBefore(ph, s2.nextSibling);
      } else {
        if (f < 0.65) root?.insertBefore(ph, s2);
      }
    }
  }

  function cleanup() {
    clearInterval(rafId);
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onCancel);
  }

  function finish(commit: boolean) {
    markJustDragged();
    cleanup();
    root?.classList.remove("catdrag");
    sec.classList.remove("lift");
    sec.style.width = "";
    sec.style.top = "";
    sec.style.left = "";

    if (commit && root) {
      const sibs = Array.from(root.children).filter(
        (x) => x === ph || (x.classList.contains("cat") && !x.classList.contains("lift"))
      );
      const k = sibs.indexOf(ph);

      const otherCats = categories.filter((c) => c.id !== category.id);
      const newOrder = computeCategoryDropOrder({
        categories: otherCats,
        dropIndex: k >= 0 ? k : otherCats.length,
      });

      if (navigator.vibrate) {
        try {
          navigator.vibrate(15);
        } catch {}
      }

      onCategoryDrop(category.id, newOrder);
    }

    if (ph.parentNode) {
      ph.parentNode.removeChild(ph);
    }
  }

  function onMove(ev: PointerEvent) {
    if (ev.pointerId !== pid) return;
    cx = ev.clientX;
    cy = ev.clientY;
    place();
  }

  function onUp(ev: PointerEvent) {
    if (ev.pointerId === pid) {
      cx = ev.clientX;
      cy = ev.clientY;
      place();
      finish(true);
    }
  }

  function onCancel() {
    finish(false);
  }

  document.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", onCancel);

  // Smooth proportional auto-scroll
  rafId = setInterval(() => {
    const topZone = 90;
    const botZone = window.innerHeight - 90;
    if (cy < topZone) {
      const dist = Math.max(1, topZone - cy);
      const speed = Math.min(18, Math.max(3, (dist / topZone) * 18));
      window.scrollBy(0, -speed);
    } else if (cy > botZone) {
      const dist = Math.max(1, cy - botZone);
      const speed = Math.min(18, Math.max(3, (dist / 90) * 18));
      window.scrollBy(0, speed);
    }
    place();
  }, 16);

  place();
}
