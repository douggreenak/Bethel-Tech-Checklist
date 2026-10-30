# Changelog

All notable changes, decisions, and deviations from the original single-file HTML app are recorded here.

---

## [1.0.0] — Initial production release

### Added (new capabilities not in the original HTML)

- **Neon Postgres backend** — tasks and history persist across devices and sessions.
- **Shared session cookie** — one passcode for the whole team; all browsers see the same data.
- **SWR polling** — data refreshes every 30 seconds and on window focus; optimistic updates keep the UI instant.
- **Vercel Cron** (`GET /api/cron/week`) — automatically rolls the week at 12:05 UTC every Monday. The client also calls `POST /api/week/check` every 30 s for redundancy.
- **Drizzle ORM migrations** — schema is code-reviewed and version-controlled; migrations run automatically on `pnpm build`.
- **`pg-mem` fallback** — when `DATABASE_URL` is absent (local development without a Neon connection), the app uses an in-memory database. Data resets on server restart but all UI features work.
- **Login rate limiting** — max 10 attempts per 10 minutes per IP, stored in the `login_attempts` Postgres table.
- **`POST /api/import`** — one-time JSON import endpoint (auth required) for seeding data from the original app's exported state.
- **PWA manifest** (`/manifest.webmanifest`) — enables "Add to Home Screen" on iOS Safari and Android Chrome with a standalone display mode.
- **Apple meta tags** — `apple-mobile-web-app-capable`, status bar style, title.
- **Vitest unit tests** — 26 tests covering `lib/time.ts` (week key, overdue, due-chip format) and `lib/order.ts` (fractional ordering, star-zone drag, auto-minimize, week roll idempotency), plus a smoke test of the pg-mem adapter.
- **Playwright e2e tests** — 8 scenarios × 2 viewports (phone 390×844, tablet 820×1180): login, add/check task, layout-shift regression, auto-collapse, new-week dialog + undo, due-time / grace / renew, theme persistence, and cross-category drag.
- **`/import` page** — browser UI for the one-time JSON import.

### Preserved (exact ports from the original HTML)

- All 19 inline SVG Material icon paths (no icon library added).
- Full CSS custom-property palette: `--bg #E3E7ED` (light), `#111318`-based dark mode, 8 accent color tiers (Sky, Sage, Rose, Amber, Coral, Slate, Violet, Teal).
- Material 3 Expressive visual style: 28 px rounded category containers, tonal surface cards, white task tiles, pill buttons, floating FAB, snackbar with undo, rounded confirmation dialog.
- All business rules ported as pure functions in `lib/time.ts` and `lib/order.ts`:
  - IANA timezone-aware week boundary (`weekKey`) — never uses device local zone.
  - `effectiveTime`, `effectiveDay`, `dueMoment`, `isOverdue`, "new-week grace" (started_at).
  - Star-zone drag (dropping before first starred → starred; after last starred → unstarred).
  - Fractional sort_order with rebalance threshold (`< 1e-6`).
  - Auto-minimize (700 ms delay, clip-path animation) and auto-expand on uncheck.
  - "Renew due times" clears `started_at` and restores past-due alerts.
  - Per-category reset (unchecks only that category, no archive, with undo snackbar).
  - Week history: upsert on week key, JSONB per-category breakdown.
- Roboto Flex font (weights 400, 500, 600) via `next/font/google`.
- Per-device preferences in `localStorage` only: theme mode, accent index, collapsed categories, auto-collapsed flags, rotation lock.
- Rotation lock toggle (CSS `transform: rotate(-90deg)` + `writing-mode: vertical-rl` trick).
- `suppressHydrationWarning` on `<html>` to prevent React mismatch from the inline theme-init script.
- Drag-and-drop via Pointer Events (no library) — `lib/dnd.ts`.
- Collapse/expand animation via Web Animations API clip-path technique — `lib/animate.ts`.
- Fractional ordering module — `lib/order.ts` (pure, tested).
- Flash-free theme init: inline `<script>` in `<head>` reads localStorage and sets `data-theme` + `data-accent` before first paint.

### Decisions made during the rebuild

| Decision | Rationale |
|---|---|
| **`pg-mem` in-memory DB fallback** | Allows `pnpm dev` without a Neon connection. Clearly documented as ephemeral. |
| **`jose` v6 in middleware** | Emits a harmless `CompressionStream` Node.js warning at build time; works correctly in Vercel Edge runtime. Kept to avoid downgrading. |
| **`vitest.config.ts`** added separately | Without it, Vitest collected Playwright spec files and failed. The config scopes Vitest to `tests/unit/**`. |
| **Session cookie name** `church_team_session` | Descriptive, prefixed to avoid conflicts. |
| **`general` category seeded in migration** | `INSERT … ON CONFLICT DO NOTHING` ensures the seed is idempotent across all deploys. |
| **`app_state` seeded in migration** | One row (`id = 1`) with `current_week = ''` is inserted; the `GET /api/state` handler sets it to the real current week on first access. |
| **Cron schedule `5 12 * * 1`** | 12:05 UTC Monday = 7:05 AM ET / 6:05 AM CT, well after the Sunday→Monday transition. Vercel Hobby users should change to `0 12 * * *` (once daily). |
| **`pnpm approve-builds --all`** | Required for pnpm v12 to allow `esbuild` and `unrs-resolver` build scripts. Stored in `pnpm-workspace.yaml`. |
| **Fractional ordering starts at `Date.now()`** for empty lists | Avoids collision if the list is populated from multiple simultaneous clients. |

### Known limitations / deviations

- **Rotation lock** works in CSS only (no native Screen Orientation API, which requires an installed app). The CSS rotation trick works on iPads but not on all Android browsers.
- **Drag-and-drop** uses Pointer Events and does not use the native HTML5 drag API (for touch support). Mouse-based `dragstart` events are not handled.
- **`pg-mem` adapter** does not support all Postgres features (e.g., some Drizzle query builders may behave differently). It is for development only; production always uses Neon.
- **Console warning in dev mode**: `ExperimentalWarning: CompressionStream is an experimental feature` — harmless, only in Node 20 dev mode.
- **`GET /api/state` rolls the week** if `app_state.current_week` is empty (first boot) or stale — this is intentional, but it means the first GET after deploy may trigger a roll if the seed left an empty week key.
