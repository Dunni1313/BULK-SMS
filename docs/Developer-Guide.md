# Developer Guide

## Before you touch anything: read `CLAUDE.md`

`CLAUDE.md` at the repo root is the authoritative, load-bearing summary of
what this project is, its engineering safety rules, and its exhaustive
phase-by-phase build history. It is not background reading — every rule
in it overrides default behavior. In particular:

1. **Never modify `execution.ts`, `optionsMath.ts`, `risk.ts`,
   `autoExecution.ts`, `autoAdjustment.ts`, or broker integration code**
   without explicit, specific approval for that exact change.
2. **Never touch `auto_execution_log`** as part of general audit-log work.
3. **Preserve backward compatibility** on every existing table, route, and
   exported function signature unless a specific, approved migration step
   says otherwise.
4. **Every database migration follows nullable → backfill → enforce-not-
   null**, with a hand-written SQL script in `lib/db/manual-migrations/`.
5. **No secret values in code, commits, or conversation.**
6. **New narration paths must route through `lib/ai-core`'s shared
   `narrate()`/`narrateStream()` pattern**, so disclaimers are enforced
   centrally, never per-caller.

## Where things live

| You want to... | Look at |
|---|---|
| Add or change a business route | `artifacts/api-server/src/routes/*.ts` |
| Add or change composition/scoring logic | `artifacts/api-server/src/lib/*.ts` |
| Change the REST contract | `lib/api-spec/openapi.yaml`, then regenerate (see below) — never hand-edit generated files |
| Add/change a database table | `lib/db/src/schema/*.ts` + a new numbered file in `lib/db/manual-migrations/` |
| Add or change a frontend page | `artifacts/ravish-trading/src/pages/*.tsx`, wired into `App.tsx` (lazy) and `lib/nav-items.ts` |
| Add a new AI Coach topic or Learning link | Follow the established `explain<Domain>Topic(topic)` / topic-catalogue pattern — see any of `lib/workspaceCoach.ts`, `lib/watchlistsCoach.ts`, `lib/investingCoach.ts` as a template |

## Regenerating the API contract

After editing `lib/api-spec/openapi.yaml`:

```bash
pnpm --filter @workspace/api-spec run codegen
```

This regenerates `lib/api-zod` (Zod validators, used server-side) and
`lib/api-client-react` (React Query hooks, used client-side). Both are
generated code — never hand-edit files under `generated/` in either
package.

**Known Orval quirks** (documented so you don't re-discover them):
- A path parameter documented alongside a query parameter on the same
  operation can cause a duplicate-export collision in the generated types.
  Workaround: document the path parameter only; the query-param behavior
  still works at runtime, just outside the formal typed contract (see
  `routes/tradingStructure.ts` for the established pattern).
- A POST 201 response reusing an already-`$ref`'d schema sometimes doesn't
  get its own generated validator — reuse another operation's
  already-generated validator with the identical shape instead of forcing
  a new one.
- Manually-named OpenAPI schemas should use an `...Input`/`...Result`
  suffix, not `...Body`/`...Response` — Orval auto-generates its own
  `<OperationId>Body`/`<OperationId>Response` names from the operationId,
  and the two naming schemes will collide if you don't distinguish them.

## Composition-layer discipline

Before writing new scoring/valuation/analytical logic, check whether an
existing module already computes it. This project's own convention:
extract a shared pure function on the *second* real caller, not
pre-emptively (`classifyMarginOfSafety()`, `classifyAgreementSignal<T>()`,
`computeWatchlistTargets()`, and dozens more named throughout `CLAUDE.md`'s
phase history are all examples of this). Every dashboard-composition
module documents in its own header comment exactly which other modules'
output it reuses "verbatim, never recomputed" — follow that pattern for
any new composition layer you write.

## Testing conventions

- Backend tests are live, end-to-end tests against a real running app
  instance and a real Postgres connection — not mocked-database unit
  tests, except for a handful of pure, I/O-free scoring functions.
- Every ownership-scoped route needs a 404-for-cross-user-access proof
  (never a separate 403 — this codebase's established anti-existence-leak
  convention).
- Every new user-scoped table needs a case added to
  `lib/tenantIsolation.test.ts`, reusing the established
  `assertTenantIsolation` helper.
- Avoid `vi.resetModules()` combined with `vi.doMock()` or a dynamic
  relative `import()` in a test file — a dedicated guardrail test
  (`src/test/page-test-pattern.guardrail.test.ts`) enforces this, since
  the pattern has repeatedly broken under parallel test-runner load in
  this project's own history. Use `vi.hoisted()` + a top-level
  `vi.mock()` + a static `import` instead.
- Do not inflate test count artificially — a test should prove a genuine
  success path, an honest-failure/honest-empty path, or a tenant-isolation
  boundary. See `docs/RC1-Test-Quality-Review.md`.

## Validation before any commit

```bash
pnpm run typecheck
pnpm --filter @workspace/api-server run test
pnpm --filter @workspace/ravish-trading run test
PORT=5000 BASE_PATH=/ pnpm run build
```

If the backend suite hits an environmental failure under parallel
execution, re-run with `vitest run --no-file-parallelism` to distinguish a
real regression from a known flake category (see
`docs/RC1-Test-Quality-Review.md`).

## Git workflow

- Commit logically — group related changes into their own commit rather
  than one giant commit per phase (this project's own established pattern
  is roughly: backend core → OpenAPI/codegen → frontend/integration →
  documentation, as separate commits).
- Never push to a branch other than the one you were told to develop on.
- Never merge without explicit instruction.
