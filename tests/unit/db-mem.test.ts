import { describe, it, expect } from "vitest";
import { newDb } from "pg-mem";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../../lib/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

describe("in-memory postgres with pg-mem", () => {
  it("works with drizzle-orm neon-http adapter", async () => {
    const mem = newDb();
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), "drizzle", "0000_strong_paladin.sql"),
      "utf-8"
    );

    const stmts = migrationSql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of stmts) {
      mem.public.none(stmt);
    }

    const adapter = mem.adapters.createPg();
    const pool = new adapter.Pool();

    const mockNeon: any = async (query: string, params: any[], options?: any) => {
      const res = await pool.query(query, params);
      if (options?.fullResults) {
        return {
          rows: options.arrayMode ? res.rows.map((r: any) => Object.values(r)) : res.rows,
          fields: res.fields || [],
          rowCount: res.rowCount,
        };
      }
      return options?.arrayMode ? res.rows.map((r: any) => Object.values(r)) : res.rows;
    };

    const db = drizzle(mockNeon, { schema });

    // Test select
    const cats = await db.select().from(schema.categories);
    expect(cats.length).toBe(1);
    expect(cats[0].id).toBe("general");

    // Test insert
    await db.insert(schema.categories).values({
      id: "sound",
      name: "Sound",
      sortOrder: 1000,
      dueTime: "09:00",
      dueDay: 0,
    });

    const updatedCats = await db.select().from(schema.categories);
    expect(updatedCats.length).toBe(2);

    // Test task insert and select
    await db.insert(schema.tasks).values({
      id: "t1",
      text: "Test mic batteries",
      categoryId: "sound",
      sortOrder: 1000,
      done: false,
      starred: false,
    });

    const soundTasks = await db.select().from(schema.tasks).where(eq(schema.tasks.categoryId, "sound"));
    expect(soundTasks.length).toBe(1);
    expect(soundTasks[0].text).toBe("Test mic batteries");
  });
});

