import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  doublePrecision,
  smallint,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: doublePrecision("sort_order").notNull(),
  dueTime: text("due_time").notNull().default(""),
  dueDay: smallint("due_day"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    text: text("text").notNull(),
    done: boolean("done").notNull().default(false),
    categoryId: text("category_id")
      .notNull()
      .default("general")
      .references(() => categories.id, { onDelete: "set default" }),
    sortOrder: doublePrecision("sort_order").notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    dueTime: text("due_time").notNull().default(""),
    starred: boolean("starred").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("tasks_category_id_sort_order_idx").on(table.categoryId, table.sortOrder),
  ]
);

export const weekHistory = pgTable("week_history", {
  week: text("week").primaryKey(),
  done: integer("done").notNull(),
  total: integer("total").notNull(),
  savedAt: timestamp("saved_at", { withTimezone: true }).notNull(),
  detail: jsonb("detail").$type<Array<{ n: string; d: number; t: number }>>().notNull(),
});

export const appState = pgTable(
  "app_state",
  {
    id: integer("id").primaryKey().default(1),
    currentWeek: text("current_week").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
  },
  (table) => [
    check("app_state_id_check", sql`${table.id} = 1`),
  ]
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: text("id").primaryKey(),
    ip: text("ip").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("login_attempts_ip_attempted_at_idx").on(table.ip, table.attemptedAt),
  ]
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type WeekHistory = typeof weekHistory.$inferSelect;
export type AppState = typeof appState.$inferSelect;
