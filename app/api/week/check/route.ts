import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appState, categories, tasks, weekHistory } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";
import { executeRollWeek } from "@/lib/roll";

export async function POST() {
  try {
    const tz = process.env.TEAM_TIMEZONE || "America/Chicago";

    // Load state, tasks, categories
    let stateList = await db.select().from(appState).where(eq(appState.id, 1));
    if (stateList.length === 0) {
      await db.insert(appState).values({ id: 1, currentWeek: "", startedAt: null }).onConflictDoNothing();
      stateList = await db.select().from(appState).where(eq(appState.id, 1));
    }
    const state = stateList[0];

    const allCategories = await db.select().from(categories).orderBy(asc(categories.sortOrder));
    const allTasks = await db.select().from(tasks).orderBy(asc(tasks.sortOrder));

    const rollResult = executeRollWeek({
      currentWeek: state.currentWeek,
      startedAt: state.startedAt,
      tasks: allTasks,
      categories: allCategories,
      now: Date.now(),
      timeZone: tz,
    });

    if (!rollResult.rolled) {
      return NextResponse.json({ rolled: false, currentWeek: rollResult.newWeek });
    }

    // In neon-http, we can execute the updates
    if (rollResult.archiveEntry) {
      await db
        .insert(weekHistory)
        .values({
          week: rollResult.archiveEntry.week,
          done: rollResult.archiveEntry.done,
          total: rollResult.archiveEntry.total,
          savedAt: rollResult.archiveEntry.savedAt,
          detail: rollResult.archiveEntry.detail,
        })
        .onConflictDoUpdate({
          target: weekHistory.week,
          set: {
            done: rollResult.archiveEntry.done,
            total: rollResult.archiveEntry.total,
            savedAt: rollResult.archiveEntry.savedAt,
            detail: rollResult.archiveEntry.detail,
          },
        });
    }

    // Reset tasks
    await db.update(tasks).set({
      done: false,
      checkedAt: null,
      updatedAt: new Date(),
    });

    // Update state
    await db
      .update(appState)
      .set({
        currentWeek: rollResult.newWeek,
        startedAt: rollResult.newStartedAt,
      })
      .where(eq(appState.id, 1));

    return NextResponse.json({
      rolled: true,
      currentWeek: rollResult.newWeek,
      startedAt: rollResult.newStartedAt,
    });
  } catch (err: any) {
    console.error("POST /api/week/check error:", err);
    return NextResponse.json({ error: "Failed to check week" }, { status: 500 });
  }
}
