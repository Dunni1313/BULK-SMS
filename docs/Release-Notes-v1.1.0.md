# Release Notes — v1.1.0

## What this release is

**v1.1.0 — Sidebar Navigation Redesign.** A bounded, frontend-only minor
release built on top of the frozen `v1.0.0` baseline (`docs/Version-1-Freeze-Declaration.md`).
`v1.0.0` itself remains untouched and frozen; this release is developed on
its own `v1.1.0-sidebar-redesign` branch and is not merged or tagged
automatically.

## Scope

Restructures the platform's single, continuous 82-item sidebar into 10
named, collapsible groups with active-route highlighting, a compact
icon-only mode, a "Frequently Used" pinned strip (up to 6 routes,
reorderable), persisted user preferences, and closes a real mobile-drawer
usability bug found during implementation (see below). No route was
removed, renamed, or made unreachable.

Full technical detail: `docs/v1.1.0-Sidebar-Navigation-Redesign.md`.

## Explicitly out of scope for this release

Trading logic, options calculations, risk calculations, execution logic,
broker integration logic, database schema, API business logic,
authentication rules, tenant isolation, and every protected file
(`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
`autoAdjustment.ts`, broker integrations) — none were touched, confirmed
via `git diff --stat`.

## What changed

- Sidebar reorganized into 10 collapsible groups (Home, Options Trading,
  Options Income Engine, Portfolio Management, Institutional Investing,
  Value Investing, Trading Workbench, AI & Decision Tools, Learning
  Centre, Administration); Home and Options Trading expanded by default.
- Compact (icon-only) mode with tooltips, toggled from the main-content
  header (also doubles as the mobile drawer's open control).
- "Frequently Used" pinned routes (up to 6), with pin/unpin, reordering,
  and cross-session persistence.
- Active route's parent group auto-expands; the active link scrolls into
  view.
- Sidebar preferences persist under the `dk-sidebar-navigation-state`
  localStorage key.
- Mobile: the drawer now closes automatically after a route is selected
  (previously stayed open).
- The existing global Command Palette / search (⌘K, Ctrl+K) is unchanged
  and continues to find every route regardless of group collapse state.

## Bug fixed during implementation

The compact-mode toggle was initially placed inside the sidebar's own
header, which — on mobile — only renders once the drawer is already open,
making it impossible to ever open the drawer. Caught by this release's
own new mobile test suite before merge; fixed by relocating the trigger
to the always-rendered main-content header.

## Test Results

- `pnpm run typecheck` — clean across the whole workspace.
- `pnpm --filter @workspace/ravish-trading run test` — 97 files / 1129
  tests, all passing (was 94 files / 1092 tests before this release; +3
  new files, +37 new tests for the redesign).
- `PORT=5000 BASE_PATH=/ pnpm run build` — succeeds. The frontend main
  bundle's chunk-size advisory warning is unchanged in category, though
  the chunk itself grew from 460.62 kB to 571.15 kB (`AppLayout` is
  eagerly loaded on every page, so the sidebar's own added code lands in
  the main chunk) — disclosed, not a new limitation category.

## Protected-file confirmation

`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
`autoAdjustment.ts`, and broker integration code all carry zero-line diff
for this release, confirmed via `git diff --stat`. No database migration,
no `openapi.yaml` change, no backend file of any kind was touched.

## Migration notes

None. No schema change, no environment variable change, no API contract
change. A user's very first visit after this release ships establishes a
sensible default (Home + Options Trading expanded, full width on desktop,
compact on tablet-width viewports, the 6 suggested pins) — nothing to
migrate.

## Versioning

This release is **not yet tagged or merged** — per the explicit
instruction, the branch (`v1.1.0-sidebar-redesign`) is pushed for review
only. Tagging `v1.1.0` and merging remain separate, explicit future steps.
