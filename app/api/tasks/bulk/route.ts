import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { tasks } from "@/lib/schema";
import { inArray } from "drizzle-orm";

const BulkPatchSchema = z.object({
  ids: z.array(z.string()).min(1, "At least one task ID required"),
  patch: z.object({
    done: z.boolean().optional(),
    checkedAt: z.union([z.string().datetime(), z.number(), z.null()]).optional(),
    categoryId: z.string().optional(),
    dueTime: z.string().optional(),
    starred: z.boolean().optional(),
    sortOrder: z.number().optional(),
  }),
});

export async function PATCH(req: NextRequest) {
  try {
    let body: unknown;
    try { body = await req.json(); } catch { body = {}; }
    const parsed = BulkPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { ids, patch } = parsed.data;
    const updates: Partial<typeof tasks.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (patch.categoryId !== undefined) updates.categoryId = patch.categoryId;
    if (patch.dueTime !== undefined) updates.dueTime = patch.dueTime;
    if (patch.starred !== undefined) updates.starred = patch.starred;
    if (patch.sortOrder !== undefined) updates.sortOrder = patch.sortOrder;

    if (patch.done !== undefined) {
      updates.done = patch.done;
      if (patch.checkedAt !== undefined) {
        updates.checkedAt = patch.checkedAt ? new Date(patch.checkedAt) : null;
      } else {
        updates.checkedAt = patch.done ? new Date() : null;
      }
    } else if (patch.checkedAt !== undefined) {
      updates.checkedAt = patch.checkedAt ? new Date(patch.checkedAt) : null;
    }

    const updated = await db
      .update(tasks)
      .set(updates)
      .where(inArray(tasks.id, ids))
      .returning();

    return NextResponse.json({ success: true, updated });
  } catch (err: any) {
    console.error("PATCH /api/tasks/bulk error:", err);
    return NextResponse.json({ error: "Failed to update tasks in bulk" }, { status: 500 });
  }
}
