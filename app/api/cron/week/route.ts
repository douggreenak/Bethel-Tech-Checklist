import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appState, categories, tasks, weekHistory } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";
import { executeRollWeek } from "@/lib/roll";
import { weekKey } from "@/lib/time";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tz = process.env.TEAM_TIMEZONE || "America/Chicago";
    const now = Date.now();
    const targetWeek = weekKey(now, tz);

    let stateList = await db.select().from(appState).where(eq(appState.id, 1));
    if (stateList.length === 0) {
      await db.insert(appState).values({ id: 1, currentWeek: "", startedAt: null }).onConflictDoNothing();
      stateList = await db.select().from(appState).where(eq(appState.id, 1));
    }
    const state = stateList[0];

    if (state.currentWeek === targetWeek) {
      return NextResponse.json({
        success: true,
        rolled: false,
        currentWeek: targetWeek,
      });
    }

    const [allCategories, allTasks] = await Promise.all([
      db.select().from(categories).orderBy(asc(categories.sortOrder)),
      db.select().from(tasks).orderBy(asc(tasks.sortOrder)),
    ]);

    const rollResult = executeRollWeek({
      currentWeek: state.currentWeek,
      startedAt: state.startedAt,
      tasks: allTasks,
      categories: allCategories,
      now,
      timeZone: tz,
    });

    if (!rollResult.rolled) {
      return NextResponse.json({
        success: true,
        rolled: false,
        currentWeek: rollResult.newWeek,
      });
    }

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

    await db.update(tasks).set({
      done: false,
      checkedAt: null,
      updatedAt: new Date(),
    });

    await db
      .update(appState)
      .set({
        currentWeek: rollResult.newWeek,
        startedAt: rollResult.newStartedAt,
      })
      .where(eq(appState.id, 1));

    return NextResponse.json({
      success: true,
      rolled: true,
      currentWeek: rollResult.newWeek,
    });
  } catch (err: any) {
    console.error("GET /api/cron/week error:", err);
    return NextResponse.json({ error: "Failed to execute cron week roll" }, { status: 500 });
  }
}
