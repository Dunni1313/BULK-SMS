# Phase 9 — Release Checklist

Companion to `docs/Phase-9-Production-Readiness-Report.md`. The go/no-go checklist for calling this a Release Candidate.

---

## Code quality

- [x] `pnpm run typecheck` clean across the whole workspace.
- [x] Zero circular dependencies, backend and frontend (`npx madge --circular`, verified fresh this phase).
- [x] Zero-line diff on all 5 CLAUDE.md-style protected files (`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, `autoAdjustment.ts`) — verified via `git diff --stat`.
- [x] 27 confirmed-unused dead component files removed, re-verified fresh (not from a stale count) via anchored-pattern grep across the entire frontend source tree before deletion.

## Testing

- [x] Backend test suite run twice: 160/161 files, 1869/1875 tests passing both times, identical result.
- [x] The one failing file (`tradeAdjustmentPreview.test.ts`) is a proven pre-existing issue, unrelated to this phase — confirmed by reproducing the identical failure against a `git stash`-clean baseline with zero Phase 9 changes applied.
- [x] Frontend test suite: 54/54 files, 596/596 tests passing, including 3 new tests for the new error boundary.
- [x] New backend middleware (`securityHeaders.ts`) has its own dedicated 5-test file, including a live end-to-end proof against the real `app.js` (not just an isolated unit test).

## Build

- [x] Production build succeeds for all packages.
- [x] No chunk-size warning printed (largest chunk 480.43 kB, under the 500 kB threshold).

## Documentation

- [x] Production Readiness Report, Technical Debt Report, Performance Report, Security Review, Deployment Checklist, and this Release Checklist all written, evidence-based, honestly disclosing what was and wasn't done.
- [x] Nothing in the repository's other, pre-existing documentation thread (`docs/Production-Readiness-Report.md`, `docs/Phase-6-Master-Planning-Document.md`, etc.) was modified or overwritten — this phase's own reports are distinctly named to avoid collision.

## Scope discipline (per the explicit Phase 9 instruction)

- [x] No new user-facing features added.
- [x] No UI redesign.
- [x] No trading calculation changed.
- [x] No execution logic changed.
- [x] No broker integration changed.
- [x] No portfolio calculation changed.

## Known, disclosed gaps (not blockers for a SIMULATED-mode Release Candidate)

- [ ] Live external data (FMP/Alpha Vantage/Alpaca) — blocked on missing credentials, not resolvable this phase.
- [ ] Content-Security-Policy — not implemented, needs a real origin inventory first.
- [ ] `alpacaApiKey` plaintext echo in Settings API — deferred, needs its own small design pass.
- [ ] `REQUIRE_AUTH` default — intentional, but must be explicitly set to `true` before any real multi-tenant deployment.
- [ ] No formal external security audit performed.

---

## Release recommendation

**Approved as a Release Candidate for SIMULATED-mode deployment.** Every scope-discipline item above is verified true, not assumed. The known gaps are all disclosed, understood, and none of them represent a silent or hidden risk — each has an explicit owner-facing note in the Technical Debt Report or Security Review pointing to exactly what would need to happen before it's resolved.

This recommendation does **not** cover live-data or live-broker go-live, which remains explicitly blocked pending credentials outside this session's control.
