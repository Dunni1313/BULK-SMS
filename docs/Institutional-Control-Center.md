# Institutional Control Center

**Phase 10 — Institutional Platform Polish & Control Center.** This document describes the new platform-organization layer this phase built: Institutional Home, the Workspace System, the Personal Dashboard, the Command Palette, Global Search, Quick Actions, and the Notification Centre. Per the phase's own explicit instruction, this was a *unify, simplify, standardize* pass — **zero changes to execution logic, pricing logic, portfolio calculations, broker integrations, risk calculations, or options mathematics.** Every one of `execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, `autoAdjustment.ts` remains a zero-line diff for this phase, confirmed via `git diff --stat` before every commit.

---

## 1. Design decisions made before writing any code

Given the size of this phase's ask, a few consolidating decisions were made up front, each disclosed here rather than silently assumed:

1. **Institutional Home is a new page, not a rewrite of `CommandCenter.tsx`.** `CommandCenter.tsx` already existed as this platform's primary landing page (mounted at `/`) with 8 fixed, non-reorderable sections and 27 existing tests. Rather than risk that working, tested page, a genuinely new `Home.tsx` was built with a real widget-array architecture (pin/hide/reorder/resize from the ground up) and mounted at `/`. `CommandCenter.tsx` itself was **not modified** — it moved to `/command-center`, still fully reachable from the sidebar, still passing all 27 of its own pre-existing tests unmodified. This mirrors a pattern already established elsewhere in this platform (e.g. Institutional Dashboard vs. Trading Research): a condensed, personalized "at a glance" page and a fuller, detail-oriented executive view, deliberately kept as two distinct, cross-linked surfaces rather than merged.
2. **The Workspace System and the Personal Dashboard are the same mechanism.** A "workspace" is a named, saved snapshot of the widget arrangement (which widgets are visible, in what order, at what size). Switching workspaces swaps the whole Personal Dashboard layout. This is a deliberate unification — building two separate persistence mechanisms for what's conceptually one thing would have violated this phase's own "unify, don't duplicate" goal.
3. **Global Search and the Command Palette are the same dialog.** Rather than building a second, nearly-identical full-page search UI, the ⌘K/Ctrl+K palette serves both roles — search across pages, positions, lessons, strategies, glossary, journal, and AI observations, or navigate/run a quick action, all from one interface. A visible "Search or jump to…" button in the header (next to the Notification Bell) makes this discoverable without requiring a user to know the keyboard shortcut.
4. **"Resize" is a binary Normal/Compact toggle, not freeform drag-resize. "Reorder" is Move Up/Move Down, not drag-and-drop.** Both are robust, fully keyboard-operable, and easily testable controls — a real drag-and-drop grid library would have added a new dependency and a much larger accessibility/testing surface for a phase explicitly scoped as polish, not new infrastructure.
5. **"Workflow Engine" is a curated, ordered navigation sequence, not a stateful business-process orchestrator.** A Workflow (`lib/workflows.ts`) is a named list of pages relevant to a common task (e.g. "Morning Portfolio Review," "Income Trading Session," "Risk Management Check," "Learning Session," "Trade Review & Journal"). Selecting one in the Command Palette navigates to its first step and shows a toast naming the remaining steps with a "Next" action to advance through them — there is no new persisted state, no cross-page session, and no new backend endpoint. A heavier interpretation (multi-step guided forms, conditional branching, saved in-progress workflow state) was judged out of scope for a phase whose own instruction was "do NOT build major new trading functionality" — this is a genuine, disclosed scoping decision, not a silent omission.
6. **The Notification Centre is a read-only aggregation, never a new alert-writer.** Every category (Alerts, Health Changes, Risk, Learning, Journal, Upcoming Earnings, Expirations) is computed client-side from already-existing, already-tested engine outputs. Nothing here persists a new database row, and nothing here is a recommendation — every item is a factual, informational statement, per the explicit "No recommendations" instruction.

---

## 2. Institutional Home (`/`, `pages/Home.tsx`)

The new landing page. A genuine Personal Dashboard: every section is an independent "widget," identified by a stable string id, with its own `visible`/`size`/`order` state persisted server-side as part of the active workspace.

### 2.1 Widgets

| Widget id | What it shows | Reused data source |
|---|---|---|
| `portfolio-health` | Health score + risk rating badge | `useGetPortfolioDashboard()` |
| `market-status` | Today's macro regime | `useGetCrossEngineDailyReport()`'s `engine1.macro` |
| `open-positions` | Count + top 5 open positions | `useListTrades({status:"open"})` |
| `todays-pnl` | Today's P/L | `useGetPortfolioSummary()` |
| `theta-income` | Monthly theta income | `useGetThetaIncome()` |
| `buying-power` | Buying power | `useGetPortfolioDashboard()` |
| `risk` | Elevated risk guidance | `useGetPortfolioDashboard()`'s `guidance` |
| `upcoming-events` | Positions with a known upcoming event | `useGetPortfolioEventRisk()` |
| `ai-briefing` | Cross-engine daily summary | `useGetCrossEngineDailyReport()`'s `summary` |
| `mentor-summary` | Top Institutional Mentor observation | `useGetInstitutionalMentor()` |
| `recent-activity` | Recent journal entries + closed trades | `useListJournalEntries()` + `useListTrades({status:"closed"})` |
| `notifications` | Unread notifications | `useListNotifications()` |
| `quick-actions` | Shortcut buttons | `lib/quick-actions.ts` |

Every widget's own hook is one already used by an existing page elsewhere in this platform — this phase introduced zero new calculations.

### 2.2 Personal Dashboard controls

"Edit Layout" mode (toggled via the header button) reveals, per widget: Move Up / Move Down (reorder), a size toggle (Normal ↔ Compact), and a visibility toggle (Show/Hide — hidden widgets render dimmed in edit mode so they can be re-enabled, and are omitted from the DOM entirely outside edit mode). "Save Layout" persists the current arrangement to the active workspace via `PATCH /workspaces/:id`.

---

## 3. Workspace System

Backed by a single new table, `dashboard_workspaces` (`lib/db/manual-migrations/021_dashboard_workspaces.sql`), and a new route file, `routes/dashboardWorkspaces.ts`:

| Endpoint | Purpose |
|---|---|
| `GET /workspaces` | List the user's workspaces (lazily creates a "Default" one if none exist yet) |
| `GET /workspaces/active` | Get the currently-active workspace |
| `POST /workspaces` | Save a new named workspace |
| `PATCH /workspaces/:id` | Rename and/or save a widget layout |
| `POST /workspaces/:id/duplicate` | Duplicate under a new name |
| `DELETE /workspaces/:id` | Delete (never the user's only remaining workspace) |
| `POST /workspaces/:id/activate` | Switch — deactivates every other workspace for the account |

A partial unique index (`dashboard_workspaces_active_idx`, on `user_id` where `is_active`) guarantees at most one active workspace per user at the database level, the same pattern `platform_notifications`' own dedup index already established. A `(user_id, name)` unique index prevents duplicate workspace names per account, surfaced to the client as an honest `409 Conflict`.

The header's Workspace Switcher (a `Select` dropdown) lets a user switch, and small icon buttons let them create a new workspace, rename, duplicate, or delete the active one — every icon button carries a real `aria-label`.

---

## 4. Global Command Palette / Global Search (`components/command/CommandPalette.tsx`)

Opened via the header's "Search or jump to…" button or the global **⌘K / Ctrl+K** keyboard shortcut (wired in `AppLayout.tsx`). Built on the pre-existing `cmdk`-based `components/ui/command.tsx` (already present in this codebase, unused until now) — full keyboard navigation (arrow keys, Enter, Escape) and fuzzy text filtering come from `cmdk` itself, no bespoke keyboard handling was written.

Groups shown: Quick Actions, Navigate (every page in the platform, sourced from the new shared `lib/nav-items.ts`), Positions, Journal, Lessons, Strategies, Glossary, AI Observations, and a small "Other" group (Institutional Home, Notification Centre). Every dynamic data source (positions, journal, glossary, etc.) is fetched **only once the palette is opened** (`enabled: open`), never eagerly on page load.

---

## 5. Quick Actions (`lib/quick-actions.ts`)

A single, static, shared list — used both inside the Command Palette and as Institutional Home's own `quick-actions` widget, so the two surfaces can never drift out of sync. Every action is a navigation to an already-existing page, except **Export Portfolio**, which is a genuine, read-only, client-side CSV download of the user's own open positions (`lib/portfolio-export.ts`) — no new backend endpoint.

---

## 5b. Workflow Engine (`lib/workflows.ts`)

The BUILD list's "Workflow Engine" item, deliberately scoped narrow per design decision §1.5 above. A `Workflow` is `{id, label, description, steps: {label, href}[]}` — a named, ordered sequence of already-existing pages. 5 curated workflows ship: Morning Portfolio Review, Income Trading Session, Risk Management Check, Learning Session, and Trade Review & Journal. They appear in a "Workflows" group in the Command Palette; selecting one navigates to the first step and shows a toast with the current step and a "Next" action to advance — implemented entirely with a closure-local step index and the existing `useToast()` hook, no new persisted state, no new backend endpoint, zero new calculations.

---

## 6. Notification Centre (`/notifications`, `pages/NotificationCentre.tsx`)

A full-page aggregation, distinct from (and linked from) the header's own `NotificationBell` popover — the bell shows a quick unread count and the platform's own persisted alerts (watchlist/risk), while this page adds 5 further categories, all computed client-side from already-fetched data: Health Changes, Risk, Learning, Journal, Upcoming Earnings, Expirations. See `pages/NotificationCentre.tsx`'s own header comment for the exact source of each category. **No recommendations anywhere on this page** — every item is a factual statement with an optional link to the page where a user could act on it themselves, never a suggested action.

---

## 7. Testing

New test files: `pages/Home.test.tsx` (6 tests — loading state, widget visibility/ordering, Edit Layout mode, Save Layout persistence, reordering, workspace switcher), `pages/NotificationCentre.test.tsx` (9 tests — loading state, honest empty states per category, real alert/health/journal/earnings/expiration items, and a proof that no recommendation-style language appears anywhere on the page), `components/command/CommandPalette.test.tsx` (9 tests — closed/open states, navigation, fuzzy filtering, position selection, CSV export, AI observations, and the Workflow Engine's first-step-navigation + toast "Next" advancement), `components/layout/AppLayout.test.tsx` (5 tests — the visible search trigger and its keyboard hint, click-to-open, Ctrl+K open, Ctrl+K toggle-closed, and the sidebar's own updated route wiring), plus a new backend test file `routes/dashboardWorkspaces.route.test.ts` (10 live end-to-end HTTP tests) and one new case in `lib/tenantIsolation.test.ts`.

---

## 8. Files changed (summary)

**New backend**: `lib/db/src/schema/dashboardWorkspaces.ts`, `lib/db/manual-migrations/021_dashboard_workspaces.sql`, `artifacts/api-server/src/lib/dashboardWorkspaces.ts`, `artifacts/api-server/src/routes/dashboardWorkspaces.ts`, `artifacts/api-server/src/routes/dashboardWorkspaces.route.test.ts`.

**New frontend**: `pages/Home.tsx` (+ test), `pages/NotificationCentre.tsx` (+ test), `components/command/CommandPalette.tsx` (+ test), `components/layout/AppLayout.test.tsx` (new), `lib/nav-items.ts`, `lib/quick-actions.ts`, `lib/portfolio-export.ts`, `lib/workflows.ts`.

**Modified**: `App.tsx` (new routes), `components/layout/AppLayout.tsx` (search trigger, ⌘K listener, nav extracted to `lib/nav-items.ts`), `lib/api-spec/openapi.yaml` + regenerated `api-zod`/`api-client-react`, `lib/db/src/schema/index.ts`, `artifacts/api-server/src/routes/index.ts`, `artifacts/api-server/src/lib/tenantIsolation.test.ts`.

**New documentation**: `docs/UI-Standards.md` (the Consistency Review deliverable — see §9 below).

**Untouched**: `execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, `autoAdjustment.ts` — confirmed zero-line diff.

---

## 9. Consistency Review & Accessibility

`docs/UI-Standards.md` formalizes the codebase's own already-dominant conventions (loading/error/empty state naming, badge-color helper patterns, table/button/card usage) as this phase's Consistency Review deliverable. **Scope decision, explicitly disclosed:** a full retrofit of every one of this platform's ~65 existing pages against that document was judged disproportionate to a "polish" phase — see that document's own §0 for the full reasoning. The two pages this phase added (`Home.tsx`, `NotificationCentre.tsx`) were built to already conform to every rule in it.

Concrete accessibility fixes made this phase: every icon-only button in the new Workspace Switcher (New / Rename / Duplicate / Delete) carries a real `aria-label`; the Workspace `Select` trigger carries an `aria-label`; the Command Palette inherits full keyboard navigation (arrow keys, Enter, Escape) from `cmdk` with no custom handling required; the header search trigger shows a visible, non-color-dependent `⌘K`/`Ctrl+K` keyboard-shortcut hint. A broader, automated accessibility audit (axe-core or similar) across the full page set was not performed this phase — disclosed as a candidate for a future, dedicated accessibility sprint.
