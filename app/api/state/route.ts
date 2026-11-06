import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appState, categories, tasks, weekHistory } from "@/lib/schema";
import { asc, desc, eq } from "drizzle-orm";
import { weekKey } from "@/lib/time";
import { needsRebalance, rebalanceList } from "@/lib/order";

export async function GET() {
  try {
    const tz = process.env.TEAM_TIMEZONE || "America/Chicago";

    // Ensure app_state exists
    let stateRow = await db.select().from(appState).where(eq(appState.id, 1));
    if (stateRow.length === 0) {
      const curWeek = weekKey(Date.now(), tz);
      await db.insert(appState).values({
        id: 1,
        currentWeek: curWeek,
        startedAt: null,
      }).onConflictDoNothing();
      stateRow = await db.select().from(appState).where(eq(appState.id, 1));
    }

    const [allCategories, allTasks, allHistory] = await Promise.all([
      db.select().from(categories).orderBy(asc(categories.sortOrder)),
      db.select().from(tasks).orderBy(asc(tasks.sortOrder)),
      db.select().from(weekHistory).orderBy(desc(weekHistory.week)),
    ]);

    // Check if category rebalance is needed
    if (allCategories.length > 1) {
      const orders = allCategories.map((c) => c.sortOrder);
      if (needsRebalance(orders)) {
        const rebalanced = rebalanceList(allCategories);
        for (const c of rebalanced) {
          await db.update(categories).set({ sortOrder: c.sortOrder }).where(eq(categories.id, c.id));
        }
      }
    }

    // Check if task rebalance is needed per category
    for (const cat of allCategories) {
      const catTasks = allTasks.filter((t) => t.categoryId === cat.id);
      if (catTasks.length > 1) {
        const orders = catTasks.map((t) => t.sortOrder);
        if (needsRebalance(orders)) {
          const rebalanced = rebalanceList(catTasks);
          for (const t of rebalanced) {
            await db.update(tasks).set({ sortOrder: t.sortOrder }).where(eq(tasks.id, t.id));
          }
        }
      }
    }

    return NextResponse.json({
      categories: allCategories,
      tasks: allTasks,
      history: allHistory,
      appState: stateRow[0],
      config: {
        timezone: tz,
      },
    });
  } catch (err: any) {
    console.error("GET /api/state error:", err);
    return NextResponse.json({ error: "Failed to load state" }, { status: 500 });
  }
}
