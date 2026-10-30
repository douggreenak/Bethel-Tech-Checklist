import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { tasks } from "@/lib/schema";
import { eq } from "drizzle-orm";

const PatchTaskSchema = z.object({
  text: z.string().min(1).optional(),
  done: z.boolean().optional(),
  categoryId: z.string().optional(),
  sortOrder: z.number().optional(),
  dueTime: z.string().optional(),
  starred: z.boolean().optional(),
  checkedAt: z.union([z.string().datetime(), z.number(), z.null()]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const parsed = PatchTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const updates: Partial<typeof tasks.$inferInsert> = {
      updatedAt: new Date(),
    };

    const data = parsed.data;
    if (data.text !== undefined) updates.text = data.text;
    if (data.categoryId !== undefined) updates.categoryId = data.categoryId;
    if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;
    if (data.dueTime !== undefined) updates.dueTime = data.dueTime;
    if (data.starred !== undefined) updates.starred = data.starred;

    if (data.done !== undefined) {
      updates.done = data.done;
      if (data.checkedAt !== undefined) {
        updates.checkedAt = data.checkedAt ? new Date(data.checkedAt) : null;
      } else {
        updates.checkedAt = data.done ? new Date() : null;
      }
    } else if (data.checkedAt !== undefined) {
      updates.checkedAt = data.checkedAt ? new Date(data.checkedAt) : null;
    }

    const [updated] = await db
      .update(tasks)
      .set(updates)
      .where(eq(tasks.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("PATCH /api/tasks/[id] error:", err);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db
      .delete(tasks)
      .where(eq(tasks.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, id: deleted.id });
  } catch (err: any) {
    console.error("DELETE /api/tasks/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
