import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import fs from "fs";
import path from "path";

// ─── Global singleton so pg-mem persists across Next.js hot-reload ──────────
declare global {
  // eslint-disable-next-line no-var
  var __pgmem_db: NeonHttpDatabase<typeof schema> | undefined;
}

function createMemoryDb(): NeonHttpDatabase<typeof schema> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { newDb } = require("pg-mem");
  const mem = newDb();

  try {
    const migrationPath = path.join(process.cwd(), "drizzle", "0000_strong_paladin.sql");
    if (fs.existsSync(migrationPath)) {
      const migrationSql = fs.readFileSync(migrationPath, "utf-8");
      const stmts = migrationSql
        .split("--> statement-breakpoint")
        .map((s: string) => s.trim())
        .filter(Boolean);

      for (const stmt of stmts) {
        mem.public.none(stmt);
      }
    }
  } catch (err) {
    console.warn("Could not apply migration to memory db:", err);
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

  return drizzle(mockNeon, { schema });
}

function getDb(): NeonHttpDatabase<typeof schema> {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    const client: NeonQueryFunction<boolean, boolean> = neon(connectionString);
    return drizzle(client, { schema });
  }

  // ── No DATABASE_URL → use in-memory pg-mem (dev / CI / tests) ──────────
  // Store on globalThis so Next.js hot-reload doesn't recreate the DB and
  // lose data that was inserted earlier in the same process.
  if (!globalThis.__pgmem_db) {
    globalThis.__pgmem_db = createMemoryDb();
  }
  return globalThis.__pgmem_db;
}

// Module-level cached db for production (avoids recreating neon() client per call)
let _prodDb: NeonHttpDatabase<typeof schema> | null = null;

export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop) {
    if (process.env.DATABASE_URL) {
      if (!_prodDb) _prodDb = getDb();
      return (_prodDb as any)[prop];
    }
    // For pg-mem, always go through getDb() which returns the global singleton
    return (getDb() as any)[prop];
  },
});
