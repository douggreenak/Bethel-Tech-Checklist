import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { categories } from "@/lib/schema";
import { desc } from "drizzle-orm";
import crypto from "crypto";

const CreateCategorySchema = z.object({
  name: z.string().min(1, "Category name cannot be empty"),
});

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try { body = await req.json(); } catch { body = {}; }
    const parsed = CreateCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { name } = parsed.data;

    // Get max sort_order
    const lastCat = await db
      .select({ sortOrder: categories.sortOrder })
      .from(categories)
      .orderBy(desc(categories.sortOrder))
      .limit(1);

    const sortOrder = lastCat.length > 0 ? lastCat[0].sortOrder + 1000 : Date.now();
    const id = "c_" + crypto.randomUUID().slice(0, 8);

    const [inserted] = await db
      .insert(categories)
      .values({
        id,
        name,
        sortOrder,
        dueTime: "",
        dueDay: null,
      })
      .returning();

    return NextResponse.json(inserted, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/categories error:", err);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
