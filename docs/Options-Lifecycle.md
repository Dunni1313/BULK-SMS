# Institutional Position Lifecycle Manager

Phase 36 — extends the Options Income Engine (Phase 35) from a static
workspace into a complete institutional lifecycle management system.

**This phase builds deterministic portfolio management workflows only.**
Nothing here implements or evaluates live brokerage execution, auto
trading, auto adjustments, AI predictions, direction forecasting, position
recommendations, trade alerts, automated rolling, or automated assignment
handling. Every stage transition, review log entry, adjustment journal
entry, and assignment note is an explicit, user-initiated write — nothing
in this codebase changes a stage, schedules a reminder, or fires a
notification on its own.

## Where to find it

`/options-lifecycle-manager`, linked from the sidebar navigation, the
Command Palette (inherits the nav entry automatically), the Cross-Engine
Quick Actions list, the Investing Executive Dashboard, the Executive
Intelligence Hub, the Cross-Engine Workspace's own Workspace Shortcuts, the
Institutional Reporting Centre (two new report types), and the Learning
Centre overview.

## Position lifecycle stages

Eight deterministic stages, set only via an explicit
`PATCH /options-lifecycle/:tradeId/state` call:

| Stage | Meaning |
|---|---|
| `draft` | A position you're still researching — never opened, cancelled, or rejected. |
| `planned` | Decided on but not yet opened. |
| `open` | A real, live position — the honest default derived from a position's own `trades.status` when no explicit lifecycle row exists yet. |
| `monitoring` | Ongoing management — you've flagged this position for closer attention. |
| `near_expiration` | Approaching its own expiration date. |
| `assignment_risk` | A short strike has moved in-the-money and may be assigned. |
| `closed` | The position's own real disposition — the honest default when `trades.status === "closed"`. |
| `archived` | Retired from active review. |

**No automatic transitions exist anywhere in this codebase.** Every stage
change is written only by `setLifecycleStage()`
(`lib/optionsLifecycle.ts`), called only from the one PATCH route above,
in response to a real HTTP request initiated by the user. The scheduler,
`autoExecution.ts`, and `autoAdjustment.ts` never import this module.

### Honest defaults, never fabricated

A position with no explicit `options_lifecycle_state` row yet gets a
stage derived from its own real `trades.status` column
(`defaultStageFor()`) — an actually-open trade is never shown as `draft`
just because no one has explicitly set a stage for it yet.

## Review schedule

A position can be assigned a review cadence — `daily`, `weekly`,
`monthly`, `expiration`, or `manual` — via the same PATCH route. **No
cadence triggers a reminder or notification anywhere in this platform.**
The cadence is a stored preference and a label to filter by; the
discipline of actually reviewing on that schedule remains entirely the
user's own.

## Position Timeline, Position History, Adjustment Journal, Assignment Tracker

All four are the **same append-only event log**
(`options_lifecycle_events`), filtered by `eventType`:

- **Position Timeline / Position History** — the full, unfiltered log for
  one position, newest first (`GET /options-lifecycle/:tradeId/timeline`).
- **Adjustment Journal** — the same log filtered to `eventType =
  "adjustment_note"`.
- **Assignment Tracker** — the same log filtered to `eventType =
  "assignment_note"`.
- Every stage change is also recorded onto this same log
  (`eventType = "stage_change"`), so the full history of a position's
  lifecycle is visible in one place.

Reviews are logged via `POST /options-lifecycle/:tradeId/events` with
`eventType: "review"` and a `reviewType` matching one of the 5 review
cadences.

## Position Checklist

Reusable institutional checklists for the 9 Strategy Library keys
(Covered Calls, Cash Secured Puts, Wheel, Iron Condor, Iron Fly, Calendar,
Diagonal, Vertical Credit, Vertical Debit), instantiated per position from
a static template (`lib/optionsLifecycleChecklists.ts`) on first read via
`?strategyKey=`. **Checklist data only** — completing every item never
submits an order, never triggers an adjustment, and never changes a
position's lifecycle stage automatically (proven directly by a dedicated
regression test).

## AI Coach

Five deterministic explanations (`lib/optionsLifecycleCoach.ts`) —
lifecycle stages, the review process, assignment mechanics, capital
allocation, and portfolio concentration. Every function takes only a
topic key, never a symbol, strike, or live quote — structurally
preventing it from ever discussing a specific real position or
recommending a trade. Reuses the platform's existing `COACH_DISCLAIMER`
unmodified.

## Learning Centre integration

Each of the 8 lifecycle stages is connected
(`lib/optionsLifecycleLearning.ts`) to relevant, already-existing Learning
Centre content — lessons, strategy explanations, risk concepts, and
assignment concepts — resolved live against `lib/learningPaths.ts`'s own
`getLearningTopic()`, never duplicated. `near_expiration` and
`assignment_risk` both connect to the real Assignment Mechanics lesson.

## API surface

| Route | Purpose |
|---|---|
| `GET /options-lifecycle/portfolio` | Portfolio Management view (see `docs/Options-Portfolio-Management.md`) |
| `GET /options-lifecycle/coach` / `/coach/:topic` | AI Coach explanations |
| `GET /options-lifecycle/learning` / `/learning/:stage` | Learning Centre links per stage |
| `GET/PATCH /options-lifecycle/:tradeId/state` | Lifecycle stage + review cadence |
| `GET /options-lifecycle/:tradeId/timeline` | Position Timeline/History |
| `POST /options-lifecycle/:tradeId/events` | Log a review, adjustment note, or assignment note |
| `GET/PATCH /options-lifecycle/:tradeId/checklist` | Position Checklist |

Every route resolves ownership via `getScopedUserId(req)` and scopes every
query by `userId` — 404, never a separate 403, for both "doesn't exist"
and "isn't yours."

## Database

Three new tables (`lib/db/manual-migrations/033_options_lifecycle_management.sql`):

- `options_lifecycle_state` — one row per position (unique on `tradeId`),
  `stage`/`reviewCadence`, `tradeId` a real FK with `ON DELETE CASCADE`
  (a genuine 1:1 sub-resource of its own trade).
- `options_lifecycle_events` — the append-only event log.
- `options_position_checklists` — one row per position (unique on
  `tradeId`), `items` a jsonb array of `{id, label, required, checked}`.

All three are brand-new tables, `NOT NULL` from creation, no backfill
needed. `execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
and `autoAdjustment.ts` were not modified.
