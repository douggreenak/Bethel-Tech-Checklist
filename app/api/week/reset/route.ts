import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appState, categories, tasks, weekHistory } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";
import { weekKey } from "@/lib/time";

export async function POST() {
  try {
    const tz = process.env.TEAM_TIMEZONE || "America/Chicago";
    const now = new Date();

    let stateList = await db.select().from(appState).where(eq(appState.id, 1));
    if (stateList.length === 0) {
      const cur = weekKey(now, tz);
      await db.insert(appState).values({ id: 1, currentWeek: cur, startedAt: null }).onConflictDoNothing();
      stateList = await db.select().from(appState).where(eq(appState.id, 1));
    }
    const state = stateList[0];
    const currentWeekKey = state.currentWeek || weekKey(now, tz);

    const allTasks = await db.select().from(tasks).orderBy(asc(tasks.sortOrder));
    const doneTasks = allTasks.filter((t) => t.done);

    if (doneTasks.length === 0) {
      return NextResponse.json(
        { error: "Nothing is checked yet, so there is nothing to reset." },
        { status: 400 }
      );
    }

    const allCategories = await db.select().from(categories).orderBy(asc(categories.sortOrder));
    const detail: Array<{ n: string; d: number; t: number }> = [];

    for (const cat of allCategories) {
      const catTasks = allTasks.filter((t) => t.categoryId === cat.id);
      if (catTasks.length > 0) {
        detail.push({
          n: cat.name,
          d: catTasks.filter((t) => t.done).length,
          t: catTasks.length,
        });
      }
    }

    // Archive current week
    await db
      .insert(weekHistory)
      .values({
        week: currentWeekKey,
        done: doneTasks.length,
        total: allTasks.length,
        savedAt: now,
        detail,
      })
      .onConflictDoUpdate({
        target: weekHistory.week,
        set: {
          done: doneTasks.length,
          total: allTasks.length,
          savedAt: now,
          detail,
        },
      });

    // Save snapshot of tasks that were done for undo
    const snapshot = doneTasks.map((t) => ({
      id: t.id,
      checkedAt: t.checkedAt ? t.checkedAt.toISOString() : null,
    }));

    // Reset tasks
    await db.update(tasks).set({
      done: false,
      checkedAt: null,
      updatedAt: now,
    });

    // Update started_at = now
    await db
      .update(appState)
      .set({
        currentWeek: currentWeekKey,
        startedAt: now,
      })
      .where(eq(appState.id, 1));

    return NextResponse.json({
      success: true,
      currentWeek: currentWeekKey,
      startedAt: now,
      previousDoneTasks: snapshot,
    });
  } catch (err: any) {
    console.error("POST /api/week/reset error:", err);
    return NextResponse.json({ error: "Failed to reset week" }, { status: 500 });
  }
}
