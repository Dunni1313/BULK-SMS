# Changelog

All notable changes to this project are recorded here at the release
level. For the exhaustive, phase-by-phase build history (every one of the
44 phases behind this release, what was reused, what was genuinely new,
every test added), see `CLAUDE.md` — this file is the release-level
summary, not a duplicate of it.

## [v1.2.0] — Trade Execution Center

A bounded, frontend-only feature release built on top of `v1.1.0`. Zero
new backend routes; zero new business logic; `execution.ts`/
`optionsMath.ts`/`risk.ts`/`autoExecution.ts`/`autoAdjustment.ts` all have
a zero-line diff for this release (confirmed via `git diff --stat`).

### Added

- New page `/trade-execution-center` — a guided, single-page workflow
  taking a scanner candidate all the way through AI Opportunity Score
  review, strategy confirmation, Order Preview, Pre-Trade Risk
  Validation, an explicit risk-acknowledgement + broker-connectivity gate,
  Paper Order Submission, Order Status, and Trade Monitor, ending with
  links to the existing Adjust/Close pages — without re-implementing any
  step's own calculation. See
  `docs/v1.2.0-Trade-Execution-Center.md` for the full dependency map.
- New safeguards genuinely specific to this workflow, not present
  elsewhere: an explicit risk-acknowledgement checkbox gating submission,
  stale-preview detection (a preview older than 60 seconds must be
  refreshed before it can be submitted), and duplicate-submission
  protection.
- A session-local activity timeline of the major actions taken during a
  workflow visit (not a new audit log — the durable trades/journal write
  is still the existing one).
- One new sidebar entry ("Trade Execution Center," in the Options Trading
  group).

### Notes

- Paper Trading only, unconditionally — no live-trading path exists in
  this codebase for this page (or any other) to expose.
- "Strategy Selection" is a review/confirm step, not a re-assignment
  picker — no backend capability exists to change a scanner candidate's
  assigned strategy, and none was fabricated for this release.

## [v1.1.0] — Sidebar Navigation Redesign

A bounded, frontend-only minor release built on top of the frozen
`v1.0.0` baseline (`docs/Version-1-Freeze-Declaration.md`). `v1.0.0`
itself is untouched; this release lives on its own
`v1.1.0-sidebar-redesign` branch and is not merged or tagged
automatically as part of this work.

### Added

- The single, continuous 82-item sidebar is now organized into 10 named,
  collapsible groups (Home, Options Trading, Options Income Engine,
  Portfolio Management, Institutional Investing, Value Investing, Trading
  Workbench, AI & Decision Tools, Learning Centre, Administration), with
  Home and Options Trading expanded by default. Every one of the original
  82 routes is preserved — none removed, renamed, or made unreachable
  (verified by a regression test asserting set-equality against the
  pre-redesign route list).
- A compact, icon-only sidebar mode with hover tooltips, toggled from the
  main-content header.
- A "Frequently Used" pinned strip (up to 6 routes), with pin/unpin,
  reordering, and cross-session persistence.
- The active route's parent group now auto-expands, and the active link
  scrolls into view.
- Sidebar preferences (expanded groups, compact mode, pinned routes)
  persist under a new `dk-sidebar-navigation-state` localStorage key.
- New files: `lib/nav-items.ts` (rewritten as the single canonical
  `NAV_GROUPS` structure), `lib/sidebar-preferences.ts`,
  `hooks/use-sidebar-preferences.ts`, `components/ui/collapsible.tsx`,
  `components/layout/SidebarNav.tsx`.

### Fixed

- A genuine mobile-usability bug found during implementation: the
  compact-mode toggle button was placed inside the sidebar's own header,
  which — on mobile — only renders once the drawer is already open,
  making it impossible to ever open the drawer in the first place. Fixed
  by relocating the trigger to the always-rendered main-content header
  (caught by this release's own new mobile test suite before merge).
- The mobile drawer now closes automatically once a route is selected
  (previously stayed open across navigation).

### Explicitly out of scope

Trading logic, options calculations, risk calculations, execution logic,
broker integration logic, database schema, API business logic,
authentication rules, and tenant isolation — none touched. Every
protected file (`execution.ts`, `optionsMath.ts`, `risk.ts`,
`autoExecution.ts`, `autoAdjustment.ts`, broker integrations) carries
zero-line diff for this release, confirmed via `git diff --stat`.

### Test results

`pnpm run typecheck` clean. `pnpm --filter @workspace/ravish-trading run
test` — 97 files / 1129 tests, all passing (was 94 files / 1092 tests
before this release; +3 new files, +37 new tests). `PORT=5000
BASE_PATH=/ pnpm run build` succeeds; the frontend main chunk grew from
460.62 kB to 571.15 kB (`AppLayout` is eagerly loaded on every page, so
the sidebar's added code lands in the main chunk) — the same disclosed
chunk-size category as before, not a new one.

See `docs/v1.1.0-Sidebar-Navigation-Redesign.md` and
`docs/Release-Notes-v1.1.0.md` for the full record.

## [v1.0.0] — First stable release

Version 1.0.0 Finalization pass over `v1.0.0-rc1`. No new functionality,
no new engines, no new dashboards, no new reports, no new AI features —
strictly a hardening/documentation/test-quality pass, per the explicit
scope of this release.

### Fixed

- `GET /executive/intelligence`'s `reporting.totalReports` field silently
  capped at 50 once a user's real report count exceeded that number (the
  query supplying it was reused, incorrectly, from a bounded
  recent-activity fetch). Fixed with a genuine, separate `COUNT(*)` query;
  `buildReportingSummary()`/`buildExecutiveIntelligenceHub()` both gained
  an optional, backward-compatible override parameter. See
  `docs/V1-Test-Resolution-Report.md` §2.
- `notifications.test.ts`'s own `cleanupUser()` helper was missing a
  delete for `investing_monitoring_states`, causing an intermittent
  foreign-key-violation test failure. Fixed (test-file only).
- 3 `portfolioEventRisk.test.ts` fixtures had drifted out of true as real
  calendar time passed, since the underlying macro-event calendar is
  genuinely date-driven (a legitimate feature, not a bug). Fixed by
  freezing the test clock to a permanently-verified date for exactly the
  3 affected describe blocks (test-file only).

### Changed

- One test timeout extended (not loosened) for an all-users orchestration
  test whose real cost scales with this session's own accumulated test
  database size.

### Test results

Backend test suite now passes at **100% deterministic pass rate — 242/242
files, 2834/2834 tests, two consecutive fully clean runs** (was 238/242
files, 2828/2834 tests, at RC1). Frontend: 94/94 files, 1092/1092 tests,
unchanged.

See `docs/Release-Notes-v1.0.0.md` and `docs/V1-Test-Resolution-Report.md`
for the full record.

## [v1.0.0-rc1] — Version 1 Release Candidate

The platform is considered **feature complete** as of this release. This
release itself added no new engine, dashboard, or analytical module —
it is a production-hardening pass over everything built across the
preceding 44 phases.

### Added (this release)

- `docs/RC1-Repository-Audit.md`, `docs/RC1-UI-UX-Review.md`,
  `docs/RC1-Performance-Review.md`, `docs/RC1-Security-Review.md`,
  `docs/RC1-Test-Quality-Review.md` — the RC1 hardening pass's own audit
  documents.
- `docs/RC1-Diagrams-And-Catalogues.md` — architecture/dependency/
  navigation/workflow diagrams, and the report/learning/AI-coach
  catalogues.
- `README.md`, `docs/Architecture.md`, `docs/Installation.md`,
  `docs/Developer-Guide.md`, `docs/Admin-Guide.md`, `docs/API-Guide.md`,
  `docs/Deployment-Guide.md`, `docs/Version-1-Feature-List.md`,
  `docs/Known-Limitations.md`, `docs/Release-Notes-v1.0.0-rc1.md`,
  `docs/RC1-Release-Checklists.md`, this `CHANGELOG.md`.

### Fixed (this release)

- A type-only circular dependency between `lib/notifications.ts` and
  `lib/monitoringEngine.ts`, extracted into a new `lib/alertTypes.ts`.
  Pure type relocation, zero behavioral change — see
  `docs/RC1-Repository-Audit.md` §7.

### Summary of everything built before this release

Three engines, one shared platform, built across 44 phases:

- **Foundation**: authentication (Better-Auth), per-user tenant isolation
  (verified on every user-scoped table), the shared `lib/ai-core`
  narration layer, and the platform audit log.
- **Engine 3 (Options Income)**: the platform's original, mature
  foundation — scanner, strategy builder, Greeks, portfolio exposure,
  automation with an explicit kill switch, AI options coach, backtesting,
  broker (Alpaca) integration.
- **Engine 1 (Institutional Investing)**: company research, 4 valuation
  models plus an AI Investment Committee, portfolio construction,
  rebalancing, risk & exposure, performance & attribution, scenario &
  stress testing, compliance, watchlists, decision support.
- **Engine 2 (Institutional Trading)**: market structure, multi-timeframe
  trend, liquidity/order-flow, market regime detection, a probability
  engine, portfolio-wide risk management, a trading journal, backtesting.
- **Cross-engine & shared surfaces**: Executive Dashboard, Executive
  Intelligence, Command Center, Cross-Engine Command Center, Macro/Regime
  Side-by-Side View, Cross-Engine Daily Report, Institutional Reporting
  Centre (32 report types), Learning Centre, 11 AI Coach modules (67
  topics), and — this project's final feature phase before RC1 — the
  Institutional Portfolio Workspace & Workflow Center (Phase 44),
  unifying every engine's overview into one workflow-driven operating
  interface.

See `CLAUDE.md` for the full, exact phase-by-phase record.

## Versioning

This project has not previously tagged a numbered release — `v1.0.0` is
the first stable tag (preceded by the `v1.0.0-rc1` release candidate).
Prior work is tracked entirely through the phase history in `CLAUDE.md`,
not through git tags or a prior changelog.
