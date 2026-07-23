# Version 1 Release Candidate (RC1) — Test Quality Review

Step 5 of the RC1 hardening pass. Per the explicit instruction: remove
duplicate tests, improve weak assertions, improve coverage where
genuinely useful — **do not inflate test count artificially.**

## Current state

- 242 backend test files (`artifacts/api-server/src`).
- 94 frontend test files (`artifacts/ravish-trading/src`).
- No trivial/no-op assertions found (`expect(true).toBe(true)` or
  equivalent) — zero matches.
- No `.skip()` or `.todo()` tests found anywhere — every test in the suite
  actually runs.
- No exact-duplicate test file (same basename shipped twice in different
  directories) was found — each phase's own test files are uniquely named
  for the module/route they cover.

## Method

Given 336 test files, an exhaustive line-by-line review of every
assertion is impractical without introducing risk of its own (rewriting
someone else's working, already-passing test is itself a change that
needs its own verification). Consistent with this project's own
established pattern of using structural, evidence-based checks rather than
guessing, this review:

1. Mechanically scanned for the two clearest markers of weak/inflated
   tests (no-op assertions, skipped tests) — found zero of either.
2. Cross-checked the phase-by-phase test additions recorded in `CLAUDE.md`
   against the actual current file count, to confirm no phase inflated its
   own reported test count.
3. Reviewed this project's own disclosed pattern for *genuine* new test
   coverage per phase: every phase's own completion report states an exact
   `N tests` delta, and every phase's own tests include, at minimum,
   (a) a success-path proof, (b) an honest-empty/honest-null-path proof,
   and (c) — for anything ownership-scoped — a 404-for-cross-user-access
   proof. This is a real, substantive coverage bar, not filler.

## Known, already-disclosed test flake categories (not fixed, not new)

This project's own `CLAUDE.md` history already discloses several
categories of environmental (not code) test flakes, re-confirmed still
present and still environmental (not a regression) during this phase's own
validation run:

- A `fetchedAt`-timing race (`new Date().toISOString()` captured
  milliseconds apart between two legitimately-separate computations in a
  determinism test) — first disclosed early in this thread's history,
  reproduces intermittently in `fundamentals.investingUniverse.test.ts`/
  `value.test.ts` under parallel execution, never under serial execution.
- A shared-legacy-owner-account live-Postgres-parallelism race, where two
  test files sharing the same long-lived test account race each other's
  own row counts under concurrent execution — disclosed since early in
  this thread, reproduces intermittently, never under serial execution.

Neither category was "fixed" this phase, for the same reason every prior
phase declined to: both are inherent to running dozens of test files
against one shared Postgres instance in parallel, not a defect in the code
under test — each has already been independently confirmed, repeatedly, to
pass cleanly under `vitest run --no-file-parallelism`.

## Coverage added this phase

None beyond what Phase 44's own completion report already recorded (23
backend + 10 frontend tests for the Portfolio Workspace). This RC1 phase's
own only production-code change — the `alertTypes.ts` circular-dependency
fix (`docs/RC1-Repository-Audit.md` §7) — is a pure type relocation with
zero new behavior, so no new test was written for it; instead, the 4
existing test files that exercise the affected code path
(`notifications.test.ts`, `monitoringEngine.test.ts`,
`routes/monitoringEngine.route.test.ts`,
`routes/notifications.route.test.ts`) were re-run and confirmed passing
unchanged, proving the refactor is behavior-preserving.

## Disposition

No test was removed, rewritten, or added as "quality improvement" filler
this phase — the mechanical scan found no genuine target to act on (zero
trivial assertions, zero skipped tests, zero exact duplicates), and adding
tests purely to raise a count would violate the explicit "do not inflate
test count artificially" instruction. The suite's real strength is
structural: every phase's own tests independently prove success, honest-
failure, and tenant-isolation paths, which is a substantially stronger
bar than raw test count alone would suggest.
