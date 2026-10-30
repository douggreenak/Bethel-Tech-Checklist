import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appState } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  try {
    await db
      .update(appState)
      .set({ startedAt: null })
      .where(eq(appState.id, 1));

    return NextResponse.json({ success: true, message: "Due times renewed" });
  } catch (err: any) {
    console.error("POST /api/week/renew error:", err);
    return NextResponse.json({ error: "Failed to renew due times" }, { status: 500 });
  }
}
