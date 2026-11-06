import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appState, categories, tasks, weekHistory } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { ImportPayloadError, parseImportPayload } from "@/lib/import";

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }
    let imported: ReturnType<typeof parseImportPayload>;
    try {
      imported = parseImportPayload(body);
    } catch (err) {
      if (err instanceof ImportPayloadError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      if (err instanceof Error && err.message.startsWith("Invalid JSON:")) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    const { categories: importCats, tasks: importTasks, history: importHistory, appState: importState } = imported.data;
    const categoryIds = new Set(["general", ...importCats.map(({ id }) => id)]);
    const missingCategoryTask = importTasks.find((task) => !categoryIds.has(task.cat || "general"));
    if (missingCategoryTask) {
      return NextResponse.json(
        { error: `Task "${missingCategoryTask.text}" references missing category "${missingCategoryTask.cat}"` },
        { status: 400 }
      );
    }

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
          dueDay: c.dueDay ?? imported.defaultDueDay ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: categories.id,
          set: {
            name: c.name,
            sortOrder: c.order,
            dueTime: c.due || "",
            dueDay: c.dueDay ?? imported.defaultDueDay ?? null,
            updatedAt: new Date(),
          },
        });
      catCount++;
    }

    let taskCount = 0;
    for (const t of importTasks) {
      const checkedAt = t.at != null && t.at !== 0 ? new Date(t.at) : null;
      const categoryId = t.cat || "general";
      await db
        .insert(tasks)
        .values({
          id: t.id,
          text: t.text,
          done: Boolean(t.done),
          categoryId,
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
            categoryId,
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
      const savedAt = h.at != null ? new Date(h.at) : new Date();
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
          startedAt: importState.startedAt != null ? new Date(importState.startedAt) : null,
        })
        .onConflictDoUpdate({
          target: appState.id,
          set: {
            currentWeek: importState.week,
            startedAt: importState.startedAt != null ? new Date(importState.startedAt) : null,
          },
        });
    }

    return NextResponse.json({
      success: true,
      message: `Imported ${catCount} ${catCount === 1 ? "category" : "categories"}, ${taskCount} ${taskCount === 1 ? "task" : "tasks"}, and ${histCount} ${histCount === 1 ? "history record" : "history records"}.`,
      settings: imported.settings,
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
