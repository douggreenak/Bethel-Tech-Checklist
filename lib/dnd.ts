import { computeTaskDropOrderAndStar, computeCategoryDropOrder } from "./order";
import { TaskData } from "@/components/TaskRow";
import { CategoryData } from "@/components/Category";

export interface DragContext {
  isDragging: boolean;
  justDragged: boolean;
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

  // Touch: press and hold for 180 ms without moving > 8px
  const sx = e.clientX;
  const sy = e.clientY;
  const pid = e.pointerId;
  let lastEvent = e.nativeEvent;

  const timer = setTimeout(() => {
    cleanupTouch();
    startFn({
      e: lastEvent,
      element: rowOrSec,
      item,
      categories,
      tasks,
      onTaskDrop,
      onCategoryDrop,
    });
  }, 180);

  function onPointerMove(ev: PointerEvent) {
    if (ev.pointerId !== pid) return;
    lastEvent = ev;
    if (Math.abs(ev.clientX - sx) > 8 || Math.abs(ev.clientY - sy) > 8) {
      cleanupTouch();
    }
  }

  function cleanupTouch() {
    clearTimeout(timer);
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", cleanupTouch);
    document.removeEventListener("pointercancel", cleanupTouch);
  }

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", cleanupTouch);
  document.addEventListener("pointercancel", cleanupTouch);
}

function startTaskDrag({
  e,
  element: row,
  item,
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
  const r = row.getBoundingClientRect();
  const offY = e.clientY - r.top;
  const offX = e.clientX - r.left;
  let cx = e.clientX;
  let cy = e.clientY;
  const pid = e.pointerId;
  let rafId: any = null;

  const ph = document.createElement("div");
  ph.className = "ph";
  ph.style.height = `${r.height}px`;
  row.parentNode?.insertBefore(ph, row);

  row.style.width = `${r.width}px`;
  row.classList.add("lift");

  if (navigator.vibrate) {
    try {
      navigator.vibrate(15);
    } catch {}
  }

  function place() {
    row.style.top = `${cy - offY}px`;
    row.style.left = `${cx - offX}px`;

    const target = document.elementFromPoint(cx, cy);
    if (!target || target.closest(".ph")) return;

    // Remove old hover highlights
    document.querySelectorAll(".over").forEach((x) => x.classList.remove("over"));

    const catsContainer = document.getElementById("cats");
    if (!catsContainer || !catsContainer.contains(target)) return;

    const sec = target.closest<HTMLElement>("#cats .cat");
    if (sec) sec.classList.add("over");

    const r2 = target.closest<HTMLElement>(".row:not(.lift)");
    if (r2 && r2.parentElement && r2.parentElement.dataset.cat) {
      const b = r2.getBoundingClientRect();
      const dn = ph.compareDocumentPosition(r2) & 4;
      const f = (cy - b.top) / b.height;
      if (dn) {
        if (f > 0.35) r2.parentElement.insertBefore(ph, r2.nextSibling);
      } else {
        if (f < 0.65) r2.parentElement.insertBefore(ph, r2);
      }
    } else if (sec) {
      const body = sec.querySelector<HTMLElement>(".catbody");
      if (body) {
        if (target.closest(".cathead")) {
          body.insertBefore(ph, body.firstChild);
        } else {
          body.appendChild(ph);
        }
      }
    }
  }

  function cleanup() {
    clearInterval(rafId);
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onCancel);
    document.querySelectorAll(".over").forEach((x) => x.classList.remove("over"));
  }

  function finish(commit: boolean) {
    cleanup();
    row.classList.remove("lift");
    row.style.width = "";
    row.style.top = "";
    row.style.left = "";

    const body = ph.parentElement;
    if (commit && body && body.dataset.cat) {
      const targetCatId = body.dataset.cat;
      const sibs = Array.from(body.children).filter(
        (x) => x === ph || (x.classList.contains("row") && !x.classList.contains("lift"))
      );
      const k = sibs.indexOf(ph);

      // Existing tasks in the target category (excluding the dragged one)
      const otherTasks = tasks.filter((t) => t.categoryId === targetCatId && t.id !== task.id);
      const { newOrder, newStarred } = computeTaskDropOrderAndStar({
        existingTasksInCat: otherTasks,
        dropIndex: k,
      });

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
  }

  function onUp(ev: PointerEvent) {
    if (ev.pointerId === pid) finish(true);
  }

  function onCancel() {
    finish(false);
  }

  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", onCancel);

  rafId = setInterval(() => {
    if (cy < 90) window.scrollBy(0, -14);
    else if (cy > window.innerHeight - 90) window.scrollBy(0, 14);
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

  root.classList.add("catdrag");

  const r = sec.getBoundingClientRect();
  const offY = r.height / 2;
  const offX = Math.min(e.clientX - r.left, r.width);
  let cx = e.clientX;
  let cy = e.clientY;
  const pid = e.pointerId;
  let rafId: any = null;

  const ph = document.createElement("div");
  ph.className = "ph";
  ph.style.height = `${r.height}px`;
  ph.style.margin = "14px 0";
  root.insertBefore(ph, sec);

  sec.style.width = `${r.width}px`;
  sec.classList.add("lift");

  if (navigator.vibrate) {
    try {
      navigator.vibrate(15);
    } catch {}
  }

  function place() {
    sec.style.top = `${cy - offY}px`;
    sec.style.left = `${cx - offX}px`;

    const target = document.elementFromPoint(cx, cy);
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
        dropIndex: k,
      });

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
  }

  function onUp(ev: PointerEvent) {
    if (ev.pointerId === pid) finish(true);
  }

  function onCancel() {
    finish(false);
  }

  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", onCancel);

  rafId = setInterval(() => {
    if (cy < 90) window.scrollBy(0, -14);
    else if (cy > window.innerHeight - 90) window.scrollBy(0, 14);
    place();
  }, 16);

  place();
}
