# Changelog

All notable changes to this project are recorded here at the release
level. For the exhaustive, phase-by-phase build history (every one of the
44 phases behind this release, what was reused, what was genuinely new,
every test added), see `CLAUDE.md` — this file is the release-level
summary, not a duplicate of it.

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
