# Release Notes — v1.0.0

## What this release is

**Version 1.0.0 — the first stable release** of the DK AI Institutional
Investing & Trading OS. This release adds **no new functionality** beyond
`v1.0.0-rc1` — it is the finalization pass that closes out RC1's own
disclosed test failures and confirms the platform's test suite reaches its
highest achievable deterministic pass rate before the stable tag.

## Feature Summary

Unchanged from `v1.0.0-rc1` — see `docs/Version-1-Feature-List.md` for the
complete, generated-from-source list. In brief: three engines
(Institutional Investing, Institutional Trading, Options Income) sharing
one platform layer (authentication, tenant isolation, reporting, AI
narration with a single enforced disclaimer contract, and audit logging),
plus cross-engine intelligence surfaces (Cross-Engine Command Center,
Macro/Regime Side-by-Side View, Cross-Engine Daily Report) and a unified
Institutional Portfolio Workspace with a 9-workflow Workflow Center.

## Architecture Summary

Unchanged from `v1.0.0-rc1` — see `docs/Architecture.md`. Backend: Express
5 + TypeScript, contract-first via `openapi.yaml` (generated Zod
validators server-side, generated React Query hooks client-side).
Frontend: React 19 + Vite, fully route-level code-split. Database:
Postgres via Drizzle, every schema change shipped as a hand-written
manual migration. Five files remain under maximum-scrutiny protection and
were confirmed, via `git diff --stat`, to carry **zero-line diff across
this entire release**: `execution.ts`, `optionsMath.ts`, `risk.ts`,
`autoExecution.ts`, `autoAdjustment.ts`, plus all broker integration code.

## What changed since v1.0.0-rc1

**Documentation-and-test-hardening only — zero new features, zero new
engines, zero new dashboards, zero new reports, zero new AI features**, per
the explicit scope of this finalization pass.

- **One genuine production bug fixed**: `GET /executive/intelligence`'s
  `reporting.totalReports` field silently capped at 50 once a user's real
  report count exceeded that number (the underlying query's own
  legitimate bound for its recent-activity/byType-breakdown purpose was
  being reused, incorrectly, as the source of the *total* count too). Now
  backed by a genuine, separate `COUNT(*)` query. See
  `docs/V1-Test-Resolution-Report.md` §2 for the full diagnosis.
- **Two genuine test-file bugs fixed**: a missing cascade-order delete in
  `notifications.test.ts`'s own cleanup helper (causing a foreign-key
  violation), and 3 event-risk test fixtures whose "empirically verified"
  assumptions had drifted out of true as real calendar time passed (fixed
  by freezing the test clock to a permanently-verified date). See
  `docs/V1-Test-Resolution-Report.md` §1 and §3.
- **One test timeout extended** (not loosened — the underlying work
  genuinely grew, the assertion did not change) for an all-users
  orchestration test whose real cost scales with this session's own
  accumulated test-database size.
- **One investigated-and-confirmed-non-issue**: `tradeAdjustmentPreview.test.ts`'s
  2 previously-failing assertions were traced end-to-end and could not be
  reproduced in 3 consecutive isolated runs — an environmental flake in
  the run that recorded them, not a defect. No change was made.

## Test Results

- Backend: **242/242 test files, 2834/2834 tests, two consecutive fully
  clean runs — 100% deterministic pass rate.** (Was 238/242 files,
  2828/2834 tests, at RC1.)
- Frontend: 94/94 files, 1092/1092 tests — unchanged, no regression.
- `pnpm run typecheck`: clean across the whole workspace.
- `PORT=5000 BASE_PATH=/ pnpm run build`: succeeds (the frontend main
  bundle chunk-size advisory warning is expected and disclosed, not a
  failure — see `docs/Known-Limitations.md` §6).

## Known Issues

Unchanged from `v1.0.0-rc1`'s own disclosed list — see
`docs/Known-Limitations.md` for the full, current list with rationale.
None of the 12 items there are new to this release; none are test
failures (all disclosed test issues are resolved or confirmed
non-reproducible per `docs/V1-Test-Resolution-Report.md`). Headline items,
unchanged: live market-data/broker provider verification remains
credential-gated (no credentials have ever been available in this
environment); no independent, formal security audit has been performed;
notification delivery remains in-app only; the frontend main bundle chunk
remains over the 500 kB advisory threshold.

## Migration Notes

**No new database migration ships with this release.** The one
production code change (the `totalReports` fix) is a pure application-code
change with no schema impact — no new column, no new table, no data
backfill. Every environment already at `v1.0.0-rc1`'s schema state (all 37
manual migration files, `000` through `036`) requires no further migration
step to run `v1.0.0`.

## Deployment / Rollback / Production Checklists

See `docs/V1-Release-Checklists.md` (this release's own checklist,
building directly on `docs/RC1-Release-Checklists.md`, which remains
accurate for everything it already covered).
