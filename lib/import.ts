import { z } from "zod";

const UnixTimestampSchema = z.number().refine(
  (value) => Number.isFinite(new Date(value).getTime()),
  "Timestamp is outside the supported date range"
);

const CategorySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  order: z.number(),
  due: z.string(),
  dueDay: z.number().int().min(0).max(6).nullable(),
  builtIn: z.boolean().optional(),
}).strict();

const TaskSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  done: z.boolean(),
  cat: z.string(),
  order: z.number(),
  at: UnixTimestampSchema.nullable(),
  due: z.string(),
  star: z.boolean(),
}).strict();

const HistorySchema = z.object({
  week: z.string(),
  done: z.number().int(),
  total: z.number().int(),
  at: UnixTimestampSchema,
  detail: z.array(
    z.object({
      n: z.string(),
      d: z.number().int(),
      t: z.number().int(),
    }).strict()
  ),
}).strict();

const AppStateSchema = z.object({
  week: z.string(),
  startedAt: UnixTimestampSchema.nullable(),
}).strict();

const LegacyImportSchema = z.object({
  categories: z.array(CategorySchema.extend({
    order: z.number().optional().default(0),
    due: z.string().optional().default(""),
    dueDay: z.number().int().min(0).max(6).nullable().optional(),
  })).optional().default([]),
  tasks: z.array(TaskSchema.extend({
    done: z.boolean().optional().default(false),
    cat: z.string().optional().default("general"),
    order: z.number().optional().default(0),
    at: UnixTimestampSchema.nullable().optional(),
    due: z.string().optional().default(""),
    star: z.boolean().optional().default(false),
  })).optional().default([]),
  history: z.array(HistorySchema.extend({
    at: UnixTimestampSchema.optional(),
    detail: z.array(
      z.object({
        n: z.string(),
        d: z.number(),
        t: z.number(),
      })
    ).optional().default([]),
  })).optional().default([]),
  appState: z.object({
    week: z.string().optional(),
    startedAt: UnixTimestampSchema.nullable().optional(),
  }).optional(),
});

const BackupSchema = z.object({
  format: z.literal("church-tech-checklist-backup"),
  formatVersion: z.literal(1),
  exportedAt: z.string().datetime(),
  source: z.object({
    app: z.string(),
    storage: z.string(),
  }).strict(),
  counts: z.object({
    categories: z.number().int().nonnegative(),
    tasks: z.number().int().nonnegative(),
    history: z.number().int().nonnegative(),
  }).strict(),
  fieldNotes: z.record(z.string(), z.string()),
  data: z.object({
    categories: z.array(CategorySchema),
    tasks: z.array(TaskSchema),
    history: z.array(HistorySchema),
    appState: AppStateSchema,
  }).strict(),
  settings: z.object({
    shared: z.object({
      defaultDueDay: z.number().int().min(0).max(6),
    }).strict(),
    device: z.object({
      theme: z.object({
        mode: z.enum(["light", "dark", "system"]).optional(),
        acc: z.number().int().min(0).max(7).optional(),
        rl: z.boolean().optional(),
      }).strict(),
      collapsedCategories: z.record(z.string(), z.boolean()),
    }).strict(),
  }).strict(),
}).strict();

export type ImportedSettings = {
  theme: {
    mode?: "light" | "dark" | "system";
    acc?: number;
    rl?: boolean;
  };
  collapsedCategories: Record<string, boolean>;
};

export function parseImportText(text: string): unknown {
  try {
    return JSON.parse(text.replace(/^\uFEFF/, "").trim());
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON: ${error.message}`);
    }
    throw error;
  }
}

export function formatImportValidationError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid import JSON format";

  const path = issue.path.length
    ? issue.path.map((part) => typeof part === "number" ? `[${part}]` : String(part)).join(".").replace(".[", "[")
    : "JSON";
  const detail = issue.code === "unrecognized_keys" && "keys" in issue
    ? `Unexpected field${issue.keys.length === 1 ? "" : "s"}: ${issue.keys.join(", ")}`
    : issue.message;
  return `${path}: ${detail}`;
}

export class ImportPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportPayloadError";
  }
}

function parseImportPayloadUnchecked(input: unknown): {
  data: z.infer<typeof LegacyImportSchema>;
  defaultDueDay?: number;
  settings?: ImportedSettings;
} {
  if (
    typeof input === "object" &&
    input !== null &&
    "format" in input
  ) {
    const backupResult = BackupSchema.safeParse(input);
    if (!backupResult.success) {
      throw new Error(formatImportValidationError(backupResult.error));
    }
    const backup = backupResult.data;
    if (
      backup.counts.categories !== backup.data.categories.length ||
      backup.counts.tasks !== backup.data.tasks.length ||
      backup.counts.history !== backup.data.history.length
    ) {
      throw new z.ZodError([
        {
          code: "custom",
          message: "Backup counts do not match the data arrays",
          path: ["counts"],
        },
      ]);
    }

    const categoryIdsInBackup = backup.data.categories.map(({ id }) => id);
    const taskIdsInBackup = backup.data.tasks.map(({ id }) => id);
    const historyWeeks = backup.data.history.map(({ week }) => week);
    if (
      new Set(categoryIdsInBackup).size !== categoryIdsInBackup.length ||
      new Set(taskIdsInBackup).size !== taskIdsInBackup.length ||
      new Set(historyWeeks).size !== historyWeeks.length
    ) {
      throw new z.ZodError([
        {
          code: "custom",
          message: "Backup contains duplicate category, task, or history identifiers",
          path: ["data"],
        },
      ]);
    }

    const unsupportedBuiltIn = backup.data.categories.find(
      ({ id, builtIn }) => builtIn && id !== "general"
    );
    if (unsupportedBuiltIn) {
      throw new z.ZodError([
        {
          code: "custom",
          message: `Built-in category "${unsupportedBuiltIn.id}" is not supported`,
          path: ["data", "categories"],
        },
      ]);
    }

    const categoryIds = new Set([
      "general",
      ...backup.data.categories.map(({ id }) => id),
    ]);
    const missingCategory = backup.data.tasks.find(({ cat }) => !categoryIds.has(cat));
    if (missingCategory) {
      throw new z.ZodError([
        {
          code: "custom",
          message: `Task "${missingCategory.text}" references missing category "${missingCategory.cat}"`,
          path: ["data", "tasks"],
        },
      ]);
    }

    const collapsedCategories: Record<string, boolean> = {};
    for (const id of categoryIds) {
      const saved = backup.settings.device.collapsedCategories;
      const state = saved[id] ?? saved[`s${id}`];
      if (state !== undefined) collapsedCategories[id] = state;
    }

    return {
      data: backup.data,
      defaultDueDay: backup.settings.shared.defaultDueDay,
      settings: {
        theme: backup.settings.device.theme,
        collapsedCategories,
      },
    };
  }

  return { data: LegacyImportSchema.parse(input) };
}

export function parseImportPayload(input: unknown): {
  data: z.infer<typeof LegacyImportSchema>;
  defaultDueDay?: number;
  settings?: ImportedSettings;
} {
  try {
    return parseImportPayloadUnchecked(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ImportPayloadError(formatImportValidationError(error));
    }
    throw error;
  }
}
