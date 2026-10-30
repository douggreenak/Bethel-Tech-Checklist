import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { appState, categories, tasks, weekHistory } from "@/lib/schema";
import { eq } from "drizzle-orm";

const ImportSchema = z.object({
  categories: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      order: z.number().optional().default(0),
      due: z.string().optional().default(""),
      dueDay: z.number().int().min(0).max(6).nullable().optional(),
    })
  ).optional().default([]),
  tasks: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      done: z.boolean().optional().default(false),
      cat: z.string().optional().default("general"),
      order: z.number().optional().default(0),
      at: z.number().nullable().optional(),
      due: z.string().optional().default(""),
      star: z.boolean().optional().default(false),
    })
  ).optional().default([]),
  history: z.array(
    z.object({
      week: z.string(),
      done: z.number(),
      total: z.number(),
      at: z.number().optional(),
      detail: z.array(
        z.object({
          n: z.string(),
          d: z.number(),
          t: z.number(),
        })
      ).optional().default([]),
    })
  ).optional().default([]),
  appState: z.object({
    week: z.string().optional(),
    startedAt: z.number().nullable().optional(),
  }).optional(),
});

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try { body = await req.json(); } catch { body = {}; }
    const parsed = ImportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid import JSON format" },
        { status: 400 }
      );
    }

    const { categories: importCats, tasks: importTasks, history: importHistory, appState: importState } = parsed.data;

    // Ensure general category exists first
    await db.insert(categories).values({
      id: "general",
      name: "General",
      sortOrder: 0,
      dueTime: "",
      dueDay: null,
    }).onConflictDoNothing();

    let catCount = 0;
    for (const c of importCats) {
      await db
        .insert(categories)
        .values({
          id: c.id,
          name: c.name,
          sortOrder: c.order,
          dueTime: c.due || "",
          dueDay: typeof c.dueDay === "number" ? c.dueDay : null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: categories.id,
          set: {
            name: c.name,
            sortOrder: c.order,
            dueTime: c.due || "",
            dueDay: typeof c.dueDay === "number" ? c.dueDay : null,
            updatedAt: new Date(),
          },
        });
      catCount++;
    }

    let taskCount = 0;
    for (const t of importTasks) {
      const checkedAt = t.at ? new Date(t.at) : null;
      await db
        .insert(tasks)
        .values({
          id: t.id,
          text: t.text,
          done: Boolean(t.done),
          categoryId: t.cat || "general",
          sortOrder: t.order,
          checkedAt,
          dueTime: t.due || "",
          starred: Boolean(t.star),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: tasks.id,
          set: {
            text: t.text,
            done: Boolean(t.done),
            categoryId: t.cat || "general",
            sortOrder: t.order,
            checkedAt,
            dueTime: t.due || "",
            starred: Boolean(t.star),
            updatedAt: new Date(),
          },
        });
      taskCount++;
    }

    let histCount = 0;
    for (const h of importHistory) {
      const savedAt = h.at ? new Date(h.at) : new Date();
      await db
        .insert(weekHistory)
        .values({
          week: h.week,
          done: h.done,
          total: h.total,
          savedAt,
          detail: h.detail,
        })
        .onConflictDoUpdate({
          target: weekHistory.week,
          set: {
            done: h.done,
            total: h.total,
            savedAt,
            detail: h.detail,
          },
        });
      histCount++;
    }

    if (importState && importState.week) {
      await db
        .insert(appState)
        .values({
          id: 1,
          currentWeek: importState.week,
          startedAt: importState.startedAt ? new Date(importState.startedAt) : null,
        })
        .onConflictDoUpdate({
          target: appState.id,
          set: {
            currentWeek: importState.week,
            startedAt: importState.startedAt ? new Date(importState.startedAt) : null,
          },
        });
    }

    return NextResponse.json({
      success: true,
      message: `Imported ${catCount} categories, ${taskCount} tasks, and ${histCount} history records.`,
      counts: {
        categories: catCount,
        tasks: taskCount,
        history: histCount,
      },
    });
  } catch (err: any) {
    console.error("POST /api/import error:", err);
    return NextResponse.json({ error: "Failed to import data" }, { status: 500 });
  }
}
