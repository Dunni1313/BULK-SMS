# Version 1.0.0 — Release Checklists

Companion to `docs/Release-Notes-v1.0.0.md`. This document only records
what's genuinely different for `v1.0.0` versus `v1.0.0-rc1` —
`docs/RC1-Release-Checklists.md` remains the accurate, complete reference
for everything it already covered (Known Issues, general Migration Notes
methodology, the Deployment/Production/Rollback checklist structure) and
is not duplicated here.

## What's different from RC1

- Backend test suite now passes at **100% deterministic (242/242 files,
  2834/2834 tests, two consecutive clean runs)** — RC1 shipped with 4
  known, disclosed failing test files. See
  `docs/V1-Test-Resolution-Report.md` for the full resolution record.
- One genuine production bug fixed (`GET /executive/intelligence`'s
  `totalReports` field). No schema change, no new environment variable, no
  new dependency.
- No other change of any kind.

## Migration Notes (v1.0.0-specific)

None beyond what `docs/RC1-Release-Checklists.md` already documents — this
release adds zero new migrations. An environment already running
`v1.0.0-rc1` needs no migration step at all to move to `v1.0.0`; a fresh
environment follows the exact same 37-file (`000`–`036`) migration
sequence already documented there.

## Deployment Checklist (v1.0.0)

Identical to `docs/RC1-Release-Checklists.md`'s own Deployment Checklist,
with the test-suite expectation updated:

- [ ] `pnpm run typecheck` — clean across the whole workspace.
- [ ] `pnpm --filter @workspace/api-server run test` — expect **242/242
      files, 2834/2834 tests passing**, run at least twice to confirm
      determinism. Any failure here is a genuine regression against this
      release's own established 100% baseline — investigate before
      shipping, do not assume it's a known/environmental issue without
      re-confirming against `docs/V1-Test-Resolution-Report.md`'s own
      documented categories first.
- [ ] `pnpm --filter @workspace/ravish-trading run test` — expect 94/94
      files, 1092/1092 tests passing.
- [ ] `PORT=5000 BASE_PATH=/ pnpm run build` — succeeds (chunk-size
      advisory warning expected, not a failure).
- [ ] Every manual migration file up to `036_portfolio_workspace.sql`
      applied to the target database (no new file this release).
- [ ] `git diff --stat` against the 5 protected files + broker integration
      confirms zero-line diff.

## Production Checklist (v1.0.0)

Identical to `docs/RC1-Release-Checklists.md`'s own Production Checklist —
no change. Re-listed here for convenience:

- [ ] `GET /api/healthz` reachable and healthy.
- [ ] `GET /api/monitoring/status` reachable, database connectivity true,
      recent successful background-job ticks.
- [ ] Real sign-up + sign-in verified end-to-end if `REQUIRE_AUTH=true`.
- [ ] The automation kill switch (`autoExecuteEnabled`/`autoAdjustEnabled`)
      is in the intended state for this deployment.
- [ ] Rate limiting confirmed active.
- [ ] `platform_audit_log` receiving real entries.
- [ ] Every live-data-provider env var either genuinely configured and
      verified, or deliberately left unset with the platform running in
      SIMULATED mode.

## Rollback Checklist (v1.0.0)

Identical to `docs/RC1-Release-Checklists.md`'s own Rollback Checklist —
no change, since this release makes no migration-involving or
schema-breaking change:

- [ ] **Automation-only concern**: disarm the kill switch via Settings —
      instant, no deployment involved.
- [ ] **Code regression, no migration involved**: redeploy the previous
      build/commit (rolling back to `v1.0.0-rc1` is safe — no schema
      divergence exists between the two releases).
- [ ] Re-run the Deployment Checklist above against the rolled-back state
      before considering the incident closed.

## Known Issues (v1.0.0)

Identical to `docs/Known-Limitations.md` — no new item, no resolved item
in that specific document this release (the resolved items were test
failures tracked in RC1's own hardening-pass documents, not in
`Known-Limitations.md` itself, which has always covered infrastructure/
credential-gated items rather than test-suite state).
