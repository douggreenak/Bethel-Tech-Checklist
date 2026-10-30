# Church Tech Checklist

A shared weekly checklist for a church tech team. Tasks repeat every Sunday. The team uses it on iPads and phones.

## Stack

- **Next.js 15** App Router · React 19 · TypeScript (strict) · pnpm · Node 20+
- **Neon Postgres** via `@neondatabase/serverless` + Drizzle ORM + drizzle-kit migrations
- **Zod** validation · **SWR** polling · **jose** signed session cookie (JWT / HS256)
- Plain CSS with CSS custom properties (Material 3 Expressive look)
- Roboto Flex via `next/font/google` · Inline SVG Material icons (no icon library)
- Vitest unit tests · Playwright e2e tests

---

## Deploy to Vercel (first time)

> **Time required:** about 10 minutes.

### 1 — Push to GitHub

```bash
git init
git add -A
git commit -m "feat: initial production app"
gh repo create church-tech-checklist --private --source=. --push
# or: git remote add origin <your-github-url> && git push -u origin main
```

### 2 — Create Vercel project

1. Go to [vercel.com/new](https://vercel.com/new).
2. Click **Add New → Project** and import the GitHub repo.
3. Keep all build settings at their defaults (Vercel detects Next.js automatically).
4. **Do NOT deploy yet** — add the database and env vars first.

### 3 — Create the Neon database

1. In your Vercel project, go to the **Storage** tab.
2. Click **Create Database → Neon (Serverless Postgres)**.
3. Choose a region close to your team (e.g., `us-east-1`).
4. Vercel automatically adds `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and related vars to your project.

### 4 — Set environment variables

In your Vercel project → **Settings → Environment Variables**, add:

| Variable | Example value | Notes |
|---|---|---|
| `TEAM_PASSCODE` | `sunday-audio-2025` | Shared passcode for the team |
| `SESSION_SECRET` | _(random 64-char string)_ | Run `openssl rand -base64 48` to generate |
| `TEAM_TIMEZONE` | `America/Chicago` | IANA name — see [list](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) |
| `CRON_SECRET` | _(random string)_ | Run `openssl rand -hex 20` |

> **Generate secrets:** `openssl rand -base64 48` (SESSION_SECRET) and `openssl rand -hex 20` (CRON_SECRET)

### 5 — Deploy

Click **Deploy**. The build script (`drizzle-kit migrate && next build`) automatically:
1. Runs Drizzle migrations against your Neon database.
2. Seeds the built-in `general` category (idempotent — safe to run repeatedly).
3. Builds the Next.js app.

Subsequent `git push` to `main` auto-deploys.

---

## Local Development

```bash
# 1. Install Vercel CLI and link project
npm i -g vercel
vercel link          # follow prompts to link to your Vercel project
vercel env pull .env.local   # pulls DATABASE_URL + your custom env vars

# 2. Install dependencies
pnpm install

# 3. (Optional) Run database migrations locally
pnpm db:migrate

# 4. Start dev server
pnpm dev
# → http://localhost:3000
```

> **No DATABASE_URL?** The app falls back to an in-memory database (`pg-mem`) automatically, so you can develop without a Neon connection. Data resets on each server restart.

---

## Available Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start Next.js dev server on port 3000 |
| `pnpm build` | Run DB migrations then build for production |
| `pnpm start` | Start production server |
| `pnpm test` | Run Vitest unit tests (26 tests) |
| `pnpm e2e` | Run Playwright e2e tests (16 tests × 2 viewports) |
| `pnpm db:generate` | Generate a new Drizzle migration after schema changes |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm lint` | Run ESLint |

---

## Cron Job (auto weekly reset)

`vercel.json` schedules `GET /api/cron/week` at `5 12 * * 1` (12:05 UTC every Monday).

> **Vercel Hobby plan:** Hobby plans only support one cron job and it must run at least once per day. If you are on Hobby, change the schedule to `0 12 * * *` (daily at noon UTC) — the handler is idempotent and safe to call every day.

The Vercel Cron authenticates with a `Bearer <CRON_SECRET>` header. The client also calls `POST /api/week/check` every 30 seconds and on focus, so the week rolls automatically even if the cron is delayed.

---

## How to Rotate the Passcode

1. Go to **Vercel → Settings → Environment Variables**.
2. Update `TEAM_PASSCODE`.
3. Redeploy (or trigger a re-deployment) — Vercel picks up the new value.
4. Tell the team the new passcode. Existing sessions remain valid until they expire (90 days).

---

## Add to iPad / iPhone Home Screen

1. Open the app URL in Safari.
2. Tap **Share → Add to Home Screen**.
3. Name it "Tech Checklist" and tap Add.

The app uses a web manifest (`/manifest.webmanifest`) and Apple meta tags, so it launches full-screen without browser chrome.

---

## Add a Custom Domain

1. Vercel project → **Settings → Domains**.
2. Add your domain (e.g., `tech.mychurch.org`).
3. Follow the DNS instructions Vercel shows (usually a CNAME or A record).

---

## Architecture Overview

```
Browser (SWR polling)
  │
  ├─ GET /api/state          ← all data in one shot
  ├─ POST /api/tasks         ← create task
  ├─ PATCH /api/tasks/[id]   ← check/uncheck, edit, reorder
  ├─ DELETE /api/tasks/[id]  ← delete task
  ├─ PATCH /api/tasks/bulk   ← bulk undo after week reset
  ├─ POST /api/categories    ← create category
  ├─ PATCH/DELETE /api/categories/[id]
  ├─ POST /api/week/check    ← idempotent weekly roll (called every 30s)
  ├─ POST /api/week/reset    ← manual new week with dialog + undo
  └─ POST /api/week/renew    ← clear "new week grace" period

Vercel Cron → GET /api/cron/week (Bearer auth)
```

### Key files

| File | Purpose |
|---|---|
| [`lib/time.ts`](lib/time.ts) | Week key, overdue, due-chip text — pure functions, timezone-aware |
| [`lib/order.ts`](lib/order.ts) | Fractional sort_order, star-zone drag, auto-minimize — pure functions |
| [`lib/roll.ts`](lib/roll.ts) | `executeRollWeek()` — the idempotent archive + reset transaction |
| [`lib/auth.ts`](lib/auth.ts) | Passcode check, JWT creation/verification, rate limiting |
| [`lib/db.ts`](lib/db.ts) | Neon driver + pg-mem fallback |
| [`lib/schema.ts`](lib/schema.ts) | Drizzle table definitions |
| [`middleware.ts`](middleware.ts) | JWT auth on every page/API route |
| [`app/page.tsx`](app/page.tsx) | Main checklist page — SWR, optimistic updates, all handlers |
| [`app/globals.css`](app/globals.css) | Material 3 Expressive CSS, custom properties, animations |

---

## Per-Device Preferences (localStorage)

These are stored in `localStorage` and never sent to the server:

- Theme mode (`light` / `dark` / `auto`)
- Accent color index (0–7)
- Collapsed category IDs
- Auto-collapsed category flags
- Rotation lock switch state

---

## Database Schema

```
categories   id, name, sort_order, due_time, due_day, created_at, updated_at
tasks        id, text, done, category_id → categories, sort_order, checked_at, due_time, starred, created_at, updated_at
week_history week (PK, Monday date), done, total, saved_at, detail (JSONB)
app_state    id=1, current_week, started_at
login_attempts ip, attempt_at (rate limiting)
```

---

## Decisions & Notes

- **`general` category** cannot be deleted (API returns 400). It can be renamed and reordered. Deleting any other category moves its tasks to `general`.
- **Week key** is the Monday date (`YYYY-MM-DD`) in `TEAM_TIMEZONE` — never the device's local time zone.
- **pg-mem fallback** enables local development without a database connection. It is ephemeral (data resets on server restart).
- **Inline SVG icons** — all 19 icon paths are inlined in `components/Icon.tsx`. No icon library is used.
- **jose v6** in Edge middleware emits a harmless Node.js `CompressionStream` warning during build. It works correctly in Vercel's runtime.
- **SWR polling** interval: 30 seconds. The week-check call runs every 30 seconds independently.
- **Fractional ordering** uses midpoint (`(a+b)/2`). If any gap falls below `1e-6`, the server rebalances that list by renumbering with steps of 1000.
- **Star-zone drag**: dropping a task before the first starred task makes it starred; dropping after the last starred task unstars it.
- **Auto-minimize**: 700 ms after the last unchecked task in a category is checked, the category collapses with a clip-path animation. Unchecking a task auto-expands.
- **New-week grace**: starting a new week (manual or auto) sets `app_state.started_at = now`, so tasks whose due time already passed are not immediately shown as overdue. "Renew due times" clears `started_at` to restore past-due alerts.
