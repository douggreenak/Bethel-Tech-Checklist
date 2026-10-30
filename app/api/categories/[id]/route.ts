import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { categories, tasks } from "@/lib/schema";
import { eq } from "drizzle-orm";

const PatchCategorySchema = z.object({
  name: z.string().min(1).optional(),
  sortOrder: z.number().optional(),
  dueTime: z.string().optional(),
  dueDay: z.number().int().min(0).max(6).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let body: unknown;
    try { body = await req.json(); } catch { body = {}; }
    const parsed = PatchCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const updates: Partial<typeof categories.$inferInsert> = {
      updatedAt: new Date(),
    };

    const data = parsed.data;
    if (data.name !== undefined) updates.name = data.name;
    if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;
    if (data.dueTime !== undefined) updates.dueTime = data.dueTime;
    if (data.dueDay !== undefined) updates.dueDay = data.dueDay;

    const [updated] = await db
      .update(categories)
      .set(updates)
      .where(eq(categories.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("PATCH /api/categories/[id] error:", err);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (id === "general") {
      return NextResponse.json(
        { error: "The built-in general category cannot be deleted" },
        { status: 400 }
      );
    }

    // Move tasks to 'general' first
    await db
      .update(tasks)
      .set({ categoryId: "general", updatedAt: new Date() })
      .where(eq(tasks.categoryId, id));

    const [deleted] = await db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, id: deleted.id, movedTo: "general" });
  } catch (err: any) {
    console.error("DELETE /api/categories/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
