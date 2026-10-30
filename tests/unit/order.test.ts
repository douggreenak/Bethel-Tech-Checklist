import { describe, it, expect } from "vitest";
import {
  calculateOrderBetween,
  needsRebalance,
  rebalanceList,
  computeTaskDropOrderAndStar,
  computeCategoryDropOrder,
  isCategoryAllDone,
  applyAutoMinimizeState,
  applyAutoExpandState,
  applyManualToggle,
} from "../../lib/order";
import { executeRollWeek } from "../../lib/roll";

describe("lib/order", () => {
  describe("fractional ordering", () => {
    it("computes midpoint between two neighbors", () => {
      expect(calculateOrderBetween(1000, 2000)).toBe(1500);
      expect(calculateOrderBetween(1500, 2000)).toBe(1750);
    });

    it("places at start (first - 1000) and at end (last + 1000)", () => {
      expect(calculateOrderBetween(null, 1000)).toBe(0);
      expect(calculateOrderBetween(2000, null)).toBe(3000);
    });

    it("uses fallback in empty list", () => {
      expect(calculateOrderBetween(null, null, 5000)).toBe(5000);
    });

    it("detects rebalance trigger when gap < 1e-6", () => {
      expect(needsRebalance([1000, 2000, 3000])).toBe(false);
      expect(needsRebalance([1000, 1000.00000001, 2000])).toBe(true);
    });

    it("rebalances list with standard 1000 increments", () => {
      const items = [
        { id: "a", sortOrder: 1000.000001 },
        { id: "b", sortOrder: 1000.0000015 },
        { id: "c", sortOrder: 2000 },
      ];
      const rebalanced = rebalanceList(items);
      expect(rebalanced).toEqual([
        { id: "a", sortOrder: 1000 },
        { id: "b", sortOrder: 2000 },
        { id: "c", sortOrder: 3000 },
      ]);
    });
  });

  describe("star-zone drop rule", () => {
    const existing = [
      { id: "s1", sortOrder: 1000, starred: true },
      { id: "s2", sortOrder: 2000, starred: true },
      { id: "u1", sortOrder: 1000, starred: false },
      { id: "u2", sortOrder: 2000, starred: false },
    ];

    it("dropping before a starred task makes it starred and sorts in star group", () => {
      // Drop at index 0 (before s1)
      const res0 = computeTaskDropOrderAndStar({
        existingTasksInCat: existing,
        dropIndex: 0,
      });
      expect(res0.newStarred).toBe(true);
      expect(res0.newOrder).toBe(0); // before s1 (1000 - 1000)

      // Drop at index 1 (between s1 and s2)
      const res1 = computeTaskDropOrderAndStar({
        existingTasksInCat: existing,
        dropIndex: 1,
      });
      expect(res1.newStarred).toBe(true);
      expect(res1.newOrder).toBe(1500); // between 1000 and 2000
    });

    it("dropping after the last starred task unstars it", () => {
      // Drop at index 2 (before u1, which is directly after s2)
      const res2 = computeTaskDropOrderAndStar({
        existingTasksInCat: existing,
        dropIndex: 2,
      });
      expect(res2.newStarred).toBe(false);
      expect(res2.newOrder).toBe(0); // before u1 (1000 - 1000 in unstarred group)

      // Drop at index 4 (end of list)
      const resEnd = computeTaskDropOrderAndStar({
        existingTasksInCat: existing,
        dropIndex: 4,
      });
      expect(resEnd.newStarred).toBe(false);
      expect(resEnd.newOrder).toBe(3000); // after u2 (2000 + 1000 in unstarred group)
    });
  });

  describe("category ordering", () => {
    it("orders categories correctly", () => {
      const cats = [
        { id: "general", sortOrder: 1000 },
        { id: "sound", sortOrder: 2000 },
      ];
      // Insert between general and sound
      expect(computeCategoryDropOrder({ categories: cats, dropIndex: 1 })).toBe(1500);
      // Insert before general
      expect(computeCategoryDropOrder({ categories: cats, dropIndex: 0 })).toBe(0);
      // Insert after sound
      expect(computeCategoryDropOrder({ categories: cats, dropIndex: 2 })).toBe(3000);
    });
  });

  describe("auto-minimize and auto-expand state transitions", () => {
    const tasks = [
      { id: "t1", categoryId: "c1", done: false },
      { id: "t2", categoryId: "c1", done: false },
    ];

    it("detects when all tasks in a category are done", () => {
      expect(isCategoryAllDone("c1", tasks)).toBe(false);
      const allDoneTasks = tasks.map((t) => ({ ...t, done: true }));
      expect(isCategoryAllDone("c1", allDoneTasks)).toBe(true);
      expect(isCategoryAllDone("c2", allDoneTasks)).toBe(false); // empty category
    });

    it("auto-collapses when last task is checked and sets auto flag", () => {
      const allDone = [
        { id: "t1", categoryId: "c1", done: true },
        { id: "t2", categoryId: "c1", done: true },
      ];
      const res = applyAutoMinimizeState({
        categoryId: "c1",
        tasks: allDone,
        collapsedMap: {},
        autoCollapsedMap: {},
      });
      expect(res.didAutoCollapse).toBe(true);
      expect(res.collapsedMap["c1"]).toBe(true);
      expect(res.autoCollapsedMap["c1"]).toBe(true);
    });

    it("auto-expands when a task becomes unchecked or is added", () => {
      const partialDone = [
        { id: "t1", categoryId: "c1", done: true },
        { id: "t2", categoryId: "c1", done: false },
      ];
      const res = applyAutoExpandState({
        categories: [{ id: "c1" }],
        tasks: partialDone,
        collapsedMap: { c1: true },
        autoCollapsedMap: { c1: true },
      });
      expect(res.changed).toBe(true);
      expect(res.collapsedMap["c1"]).toBe(false);
      expect(res.autoCollapsedMap["c1"]).toBe(false);
    });

    it("manual header click toggles collapsed and clears auto flag", () => {
      const toggled = applyManualToggle({
        categoryId: "c1",
        collapsedMap: { c1: true },
        autoCollapsedMap: { c1: true },
      });
      expect(toggled.collapsedMap["c1"]).toBe(false);
      expect(toggled.autoCollapsedMap["c1"]).toBe(false);
    });
  });

  describe("rollWeekIfNeeded idempotency and archiving", () => {
    const cats = [
      { id: "general", name: "General", sortOrder: 0 },
      { id: "sound", name: "Sound", sortOrder: 1000 },
    ];
    const tasks = [
      {
        id: "t1",
        text: "Mics battery",
        done: true,
        categoryId: "sound",
        sortOrder: 1000,
        dueTime: "09:00",
        starred: true,
      },
      {
        id: "t2",
        text: "Clean booth",
        done: false,
        categoryId: "sound",
        sortOrder: 2000,
        dueTime: "",
        starred: false,
      },
    ];

    it("archives week with done tasks and rolls to new week", () => {
      const now = new Date("2026-10-12T10:00:00Z"); // Monday in week 2026-10-12
      const firstRoll = executeRollWeek({
        currentWeek: "2026-10-05",
        startedAt: new Date("2026-10-05T10:00:00Z"),
        tasks,
        categories: cats,
        now,
      });

      expect(firstRoll.rolled).toBe(true);
      expect(firstRoll.newWeek).toBe("2026-10-12");
      expect(firstRoll.archiveEntry).toBeDefined();
      expect(firstRoll.archiveEntry?.week).toBe("2026-10-05");
      expect(firstRoll.archiveEntry?.done).toBe(1);
      expect(firstRoll.archiveEntry?.total).toBe(2);
      expect(firstRoll.archiveEntry?.detail).toEqual([
        { n: "Sound", d: 1, t: 2 },
      ]);
      expect(firstRoll.tasksToUpdate.every((t) => t.done === false && t.checkedAt === null)).toBe(true);

      // Running second time (idempotent):
      const secondRoll = executeRollWeek({
        currentWeek: firstRoll.newWeek,
        startedAt: firstRoll.newStartedAt,
        tasks: tasks.map((t) => ({ ...t, done: false })),
        categories: cats,
        now,
      });

      expect(secondRoll.rolled).toBe(false);
      expect(secondRoll.archiveEntry).toBeUndefined();
    });

    it("does not archive a week with zero done tasks", () => {
      const allUndoneTasks = tasks.map((t) => ({ ...t, done: false }));
      const now = new Date("2026-10-12T10:00:00Z");
      const roll = executeRollWeek({
        currentWeek: "2026-10-05",
        startedAt: null,
        tasks: allUndoneTasks,
        categories: cats,
        now,
      });

      expect(roll.rolled).toBe(true);
      expect(roll.newWeek).toBe("2026-10-12");
      expect(roll.archiveEntry).toBeUndefined(); // Nothing to archive!
    });
  });
});
