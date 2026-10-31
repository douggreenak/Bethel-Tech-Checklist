import { describe, expect, it } from "vitest";
import { parseImportPayload } from "../../lib/import";

const backupV1 = {
  format: "church-tech-checklist-backup",
  formatVersion: 1,
  exportedAt: "2026-10-31T21:59:25.348Z",
  source: { app: "Church Tech Checklist", storage: "account" },
  counts: { categories: 2, tasks: 1, history: 1 },
  fieldNotes: { "tasks.cat": "category id" },
  data: {
    categories: [
      { id: "general", name: "Auditorium", order: 10, due: "07:50", dueDay: null, builtIn: true },
      { id: "thursday", name: "Thursday", order: 20, due: "20:00", dueDay: 4 },
    ],
    tasks: [
      {
        id: "task-1",
        text: "Test audio",
        done: true,
        cat: "general",
        order: 11,
        at: 1793333679073,
        due: "09:00",
        star: true,
      },
    ],
    history: [
      {
        week: "2026-10-19",
        done: 1,
        total: 1,
        at: 1793333398246,
        detail: [{ n: "Auditorium", d: 1, t: 1 }],
      },
    ],
    appState: { week: "2026-10-26", startedAt: 1793333398247 },
  },
  settings: {
    shared: { defaultDueDay: 4 },
    device: {
      theme: { acc: 1 },
      collapsedCategories: {
        sgeneral: false,
        general: true,
        sthursday: false,
      },
    },
  },
};

describe("backup import parser", () => {
  it("preserves the versioned backup data and maps its settings", () => {
    const parsed = parseImportPayload(backupV1);

    expect(parsed.data.categories).toHaveLength(2);
    expect(parsed.data.categories[0]).toMatchObject({
      id: "general",
      name: "Auditorium",
      dueDay: null,
      builtIn: true,
    });
    expect(parsed.data.tasks[0]).toMatchObject({
      id: "task-1",
      done: true,
      cat: "general",
      at: 1793333679073,
      due: "09:00",
      star: true,
    });
    expect(parsed.data.history[0]).toMatchObject({
      week: "2026-10-19",
      done: 1,
      total: 1,
      detail: [{ n: "Auditorium", d: 1, t: 1 }],
    });
    expect(parsed.data.appState).toEqual({
      week: "2026-10-26",
      startedAt: 1793333398247,
    });
    expect(parsed.defaultDueDay).toBe(4);
    expect(parsed.settings).toEqual({
      theme: { acc: 1 },
      collapsedCategories: { general: true, thursday: false },
    });
  });

  it("rejects malformed or incomplete versioned backups instead of importing empty data", () => {
    expect(() => parseImportPayload({ ...backupV1, formatVersion: 2 })).toThrow();
    expect(() =>
      parseImportPayload({
        ...backupV1,
        counts: { ...backupV1.counts, tasks: 0 },
      })
    ).toThrow(/counts do not match/i);
    expect(() =>
      parseImportPayload({
        ...backupV1,
        data: {
          ...backupV1.data,
          tasks: [{ ...backupV1.data.tasks[0], cat: "missing" }],
        },
      })
    ).toThrow(/references missing category/i);
  });

  it("continues accepting the legacy root-level format", () => {
    const parsed = parseImportPayload({
      categories: [{ id: "general", name: "General" }],
      tasks: [{ id: "task-legacy", text: "Legacy task" }],
      history: [],
    });

    expect(parsed.data.categories[0]).toMatchObject({ order: 0, due: "" });
    expect(parsed.data.tasks[0]).toMatchObject({
      done: false,
      cat: "general",
      order: 0,
      due: "",
      star: false,
    });
    expect(parsed.defaultDueDay).toBeUndefined();
  });
});
