CREATE TABLE "app_state" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"current_week" text NOT NULL,
	"started_at" timestamp with time zone,
	CONSTRAINT "app_state_id_check" CHECK ("app_state"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" double precision NOT NULL,
	"due_time" text DEFAULT '' NOT NULL,
	"due_day" smallint,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"ip" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"category_id" text DEFAULT 'general' NOT NULL,
	"sort_order" double precision NOT NULL,
	"checked_at" timestamp with time zone,
	"due_time" text DEFAULT '' NOT NULL,
	"starred" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "week_history" (
	"week" text PRIMARY KEY NOT NULL,
	"done" integer NOT NULL,
	"total" integer NOT NULL,
	"saved_at" timestamp with time zone NOT NULL,
	"detail" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set default ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "login_attempts_ip_attempted_at_idx" ON "login_attempts" USING btree ("ip","attempted_at");--> statement-breakpoint
CREATE INDEX "tasks_category_id_sort_order_idx" ON "tasks" USING btree ("category_id","sort_order");--> statement-breakpoint
INSERT INTO "categories" ("id", "name", "sort_order", "due_time", "due_day")
VALUES ('general', 'General', 0, '', null)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "app_state" ("id", "current_week", "started_at")
VALUES (1, '', null)
ON CONFLICT ("id") DO NOTHING;
