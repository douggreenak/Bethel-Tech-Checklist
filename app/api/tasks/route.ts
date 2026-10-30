import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { tasks } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import crypto from "crypto";

const CreateTaskSchema = z.object({
  text: z.string().min(1, "Task text cannot be empty"),
  categoryId: z.string().default("general"),
  dueTime: z.string().optional().default(""),
});

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try { body = await req.json(); } catch { body = {}; }
    const parsed = CreateTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { text, categoryId, dueTime } = parsed.data;

    // Determine sort_order: place at end of category
    const lastTask = await db
      .select({ sortOrder: tasks.sortOrder })
      .from(tasks)
      .where(eq(tasks.categoryId, categoryId))
      .orderBy(desc(tasks.sortOrder))
      .limit(1);

    const sortOrder = lastTask.length > 0 ? lastTask[0].sortOrder + 1000 : Date.now();
    const id = "t_" + crypto.randomUUID().slice(0, 8);

    const [inserted] = await db
      .insert(tasks)
      .values({
        id,
        text,
        categoryId,
        sortOrder,
        dueTime: dueTime || "",
        done: false,
        starred: false,
        checkedAt: null,
      })
      .returning();

    return NextResponse.json(inserted, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/tasks error:", err);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
