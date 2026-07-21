# Release Notes — v1.0.0-rc1

## What this release is

The first Release Candidate of the DK AI Institutional Investing & Trading
OS. The platform is **feature complete**: three engines (Institutional
Investing, Institutional Trading, Options Income) sharing one platform
layer, plus cross-engine intelligence surfaces and a unified Portfolio
Workspace. This release itself adds no new feature — it is a production-
hardening pass. See `CHANGELOG.md` for the full summary and `CLAUDE.md`
for the exhaustive phase-by-phase build history.

## Highlights of this hardening pass

- **Repository audit** (`docs/RC1-Repository-Audit.md`): zero TODO/FIXME/
  dead-code markers, zero unused routes/tables/pages found — one real
  structural issue found and fixed (a type-only circular import between
  `lib/notifications.ts` and `lib/monitoringEngine.ts`).
- **UI/UX review** (`docs/RC1-UI-UX-Review.md`): near-universal adoption
  of shared Card/Skeleton/Badge primitives across all 74 pages; two
  known, disclosed, low-risk cosmetic gaps on the platform's oldest pages.
- **Performance review** (`docs/RC1-Performance-Review.md`): full
  code-splitting/lazy-loading already in place; the frontend main bundle
  chunk is 559.61 kB, over the 500 kB advisory threshold — disclosed, not
  risked a fix without a dedicated future effort.
- **Security review** (`docs/RC1-Security-Review.md`): every protection
  from the platform's prior hardening pass (security headers, global error
  handling, uncaught-exception handling, rate limiting, tenant isolation,
  admin authorization) confirmed still in place and correctly scoped. No
  new defect found. Self-review, not an independent audit — disclosed
  explicitly.
- **Test quality review** (`docs/RC1-Test-Quality-Review.md`): 242 backend
  + 94 frontend test files, zero trivial/no-op assertions, zero skipped
  tests. No count-inflating filler added.
- **New documentation**: a root `README.md`, `CHANGELOG.md`, and 9 new
  guides/references under `docs/` (Architecture, Installation, Developer
  Guide, Admin Guide, API Guide, Deployment Guide, Version 1 Feature List,
  Known Limitations, and this document) plus a full diagrams/catalogues
  reference.

## What's genuinely new in this release vs. Phase 44

One production code change: the `lib/alertTypes.ts` extraction (a pure
type relocation, zero behavioral change, verified by re-running the 4
affected test files and confirming `madge --circular` now reports zero
cycles). Everything else this release adds is documentation.

## Known issues / deferrals

See `docs/Known-Limitations.md` for the full list. The headline items:

- Live market-data provider verification (FMP/Alpha Vantage, Engine 1;
  live broker credentials, Engine 3) has never been performed in this
  environment — no credentials have ever been available. Every engine
  runs fully functional in SIMULATED mode.
- No formal, independent security audit has been performed — every
  security review in this repository is a self-review, disclosed as such.
- Notification delivery is in-app only (no email/push).
- The frontend main bundle chunk exceeds the 500 kB advisory threshold.

## Protected areas — confirmed unchanged

`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
`autoAdjustment.ts`, and all broker integration files show **zero-line
diff** for this entire release, confirmed via `git diff --stat` against
the pre-RC1 baseline.

## Upgrade / migration notes

No new database migration ships with this release — the `alertTypes.ts`
extraction is a pure TypeScript refactor with no schema impact. See
`docs/RC1-Release-Checklists.md` for the full migration-state checklist
(every manual migration file through this release's own schema state).
