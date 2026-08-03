# Database Concurrency Fixes

**Type:** Repository maintenance, not a feature or UX sprint. Fixes
pre-existing backend race conditions surfaced by recurring CI failures
across unrelated pull requests (PR #46, PR #47) — see the CI evidence
gathered before this work began, summarized below. No frontend UX
implementation, trading logic, execution safeguards, or portfolio
calculations were touched. `execution.ts`, `optionsMath.ts`, `risk.ts`,
`autoExecution.ts`, `autoAdjustment.ts` all remain zero-line diff.

---

## Root cause

Several lazy "get or create" and "insert, tolerate duplicate" code paths
used a **check-then-insert** pattern: a `SELECT` to see whether a row
already exists, followed by a separate, unconditional `INSERT` if it
didn't. Between those two statements there is a real window in which a
second, concurrent request for the *same* not-yet-existing row (most
commonly: several widgets on a page all independently resolving a
brand-new user's first-ever settings/workspace row on the very first
mount after sign-up) can also pass the same `SELECT`, and then both
requests attempt the same `INSERT` — the second one violates a unique
constraint. Two of these were **uncaught**, producing a real 500 to the
caller; the CI evidence below traces PR #47's own E2E sign-up failures
(4 of 7 Playwright specs, all timing out on the same `signUpAndLogin()`
helper, never leaving `/login`) directly to this category. Three further
call sites used a plain `INSERT` relying on the *caller* catching a
thrown unique-violation exception to detect a duplicate — correct in
outcome (already mapped to an honest 4xx, never a 500) but unnecessarily
noisy: Postgres logs a full `ERROR` line at the database level for any
constraint violation, whether or not the calling code catches it,
matching the `.github/workflows/ci.yml`-documented pattern that has
"been failing on every one of the last 4 CI runs on main, across
entirely unrelated commits."

## Files changed

| File | Function | Was | Now |
|---|---|---|---|
| `artifacts/api-server/src/lib/serverState.ts` | `getSettingsRow()` | Check-then-insert, **uncaught** on race | Single atomic `INSERT ... ON CONFLICT (user_id) DO UPDATE ... RETURNING` |
| `artifacts/api-server/src/lib/dashboardWorkspaces.ts` | `getOrCreateActiveWorkspace()` | Check-then-insert (2 SELECTs + a final INSERT), **uncaught** on race, and uncaught at both of its own calling routes (`GET /workspaces`, `GET /workspaces/active`) | The final "create Default" INSERT is now `ON CONFLICT (user_id, name) DO UPDATE ... RETURNING` |
| `artifacts/api-server/src/lib/dashboardWorkspaces.ts` | `createWorkspace()`, `duplicateWorkspace()` | Plain INSERT, caller caught the thrown 23505 exception → 409 | `ON CONFLICT (user_id, name) DO NOTHING` + explicit `"duplicate"` return value; caller checks the return value instead of catching an exception |
| `artifacts/api-server/src/routes/dashboardWorkspaces.ts` | `POST /workspaces`, `POST /workspaces/:id/duplicate` | `try/catch` around the lib call, mapping any thrown error to 409 | Checks the lib function's new `"duplicate"` return value; same 409, no `try/catch` |
| `artifacts/api-server/src/lib/workspacePins.ts` | `pinResource()` | Plain INSERT, caught the thrown 23505 exception (identified via `err.cause.code`) → `"duplicate"` | `ON CONFLICT (user_id, resource_type, resource_key) DO NOTHING` + the same `"duplicate"` return value, no exception involved |
| `artifacts/api-server/src/lib/watchlists.ts` | `addItem()` | Plain INSERT, caller's `try/catch` mapped *any* thrown error to "already on this watchlist" | `ON CONFLICT (watchlist_id, symbol) DO NOTHING` + explicit `"duplicate"` return value |
| `artifacts/api-server/src/routes/watchlists.ts` | `POST /investing/watchlists/:id/items` | `try/catch` around `addItem()`, mapping any thrown error to 400 | Checks `addItem()`'s new `null` / `"duplicate"` / row return values directly; same 404/400, no `try/catch` |

`lib/db/src/auditLog.ts` (`recordAuditEvent()`, backing `platform_audit_log`)
was investigated and **deliberately not changed** — see below.

## Why the race occurred

Two distinct shapes, both already documented inline at each fix site:

1. **Uncaught check-then-insert** (`getSettingsRow()`,
   `getOrCreateActiveWorkspace()`) — a genuinely new user's very first
   page load fires several concurrent requests (multiple widgets on the
   Institutional Home page each independently resolving settings and/or
   the active dashboard workspace on mount). Each one runs the same
   `SELECT ... WHERE user_id = $1` against a table where no row for that
   user exists yet, all of them see "no row," and more than one proceeds
   to `INSERT`. The first succeeds; every subsequent one throws a unique-
   constraint violation with **no `try/catch` anywhere in the call
   chain**, so it propagated as an uncaught error — a real 500 back to
   the browser during the exact moment PR #47's E2E specs poll for a
   successful post-sign-up redirect, which is why those specs timed out
   waiting on `/login` instead of ever reaching `/`.
2. **Caught-but-noisy plain insert** (`pinResource()`, `addItem()`,
   `createWorkspace()`, `duplicateWorkspace()`) — these never actually
   failed a request (each already had a `try/catch` mapping the
   duplicate case to an honest 4xx), but a plain `INSERT` that relies on
   Postgres raising an exception for a unique-constraint violation always
   logs a full `ERROR` line at the database level first, regardless of
   whether the application goes on to catch and handle it gracefully.
   That's what was actually showing up as `duplicate key value violates
   unique constraint "workspace_pinned_resources_user_resource_unique"`
   etc. in the CI job's own `docker logs` output — real, but never the
   cause of an actual test failure.

`platform_audit_log`'s own foreign-key violation (`insert or update on
table "platform_audit_log" violates foreign key constraint
"platform_audit_log_user_id_users_id_fk"`) is a **third, different**
shape: `recordAuditEvent()` (`lib/db/src/auditLog.ts`) is already fully
wrapped in `try/catch` and, by design (documented in its own header
comment since Phase 1 Sprint 10), **never throws back to its caller** —
a failed audit write must never break the request that triggered it,
mirroring `auto_execution_log`'s own established best-effort philosophy.
Every call site (`lib/auth/src/index.ts`'s sign-in/sign-up hook,
`routes/settings.ts`'s `PATCH` handler, `lib/systemHealth.ts`'s monitoring
alert persistence) already `await`s the call correctly — there is no
missing-await race to fix. The FK violation itself reflects a genuine,
expected race between an audit write for a real user and that same
user's own concurrent or immediately-subsequent deletion (a test's own
cleanup, most plausibly) — inherent to an audit trail whose subject can
be deleted at any time, and already handled the only way a *best-effort,
must-never-block* writer safely can: by not throwing. Adding a
existence-check before the write would reintroduce exactly the
check-then-insert race this whole effort exists to remove, for a write
whose own failure mode is already fully absorbed. **No code change was
made here** — this is a confirmed, disclosed, already-safe-by-design
behavior, not a bug.

## Why the new implementation is safe

- **Every fix uses a single, atomic, single-round-trip SQL statement**
  (`INSERT ... ON CONFLICT ...`) instead of two separate statements
  (`SELECT` then `INSERT`) — there is no window between the two where a
  second writer can interleave, because there is no "two" anymore.
- **`ON CONFLICT DO UPDATE ... RETURNING`** (`getSettingsRow()`,
  `getOrCreateActiveWorkspace()`'s Default-workspace creation) always
  returns exactly one row, whichever concurrent caller's own `INSERT`
  statement actually wins the race at the database level — every caller
  gets back the same, single, correct row. The "update" on the losing
  side is a genuine no-op (`user_id` written back to its own already-
  correct value), so the conflict path never actually changes any data,
  it only guarantees a row is returned.
- **`ON CONFLICT DO NOTHING`** (`pinResource()`, `addItem()`,
  `createWorkspace()`, `duplicateWorkspace()`) makes a genuine duplicate
  silent at the database level — no row returned, no exception thrown,
  no `ERROR` logged — and the calling code distinguishes "created" from
  "already existed" via the returned row being present or absent, an
  explicit, typed sentinel (`"duplicate"`) rather than exception-based
  control flow.
- **No external behavior changed for any existing caller.** Every route
  that previously returned a 404/400/409 on a duplicate/not-found
  condition still returns the exact same status code and (with one
  disclosed exception below) the same error message — confirmed by
  reading every existing route test that exercises these duplicate/
  not-found paths before making the change; none asserts on the internal
  exception mechanism, only on the resulting HTTP status.
- **One minor, disclosed response-shape change:** `POST
  /investing/watchlists/:id/items`'s 400 response for a duplicate symbol
  no longer includes a `cause` field (previously the caught exception's
  own message, e.g. Drizzle's raw SQL text) — the `error` message and
  400 status are unchanged, and no existing test asserted on `cause`
  (confirmed by search before removing it).
- **This mirrors an already-established, already-tested pattern in this
  same codebase** — `lib/learningProgress.ts`'s `recordViewed()`/
  `recordCompleted()` and `lib/intelligenceTimeline.ts` both already use
  `onConflictDoUpdate()`/`onConflictDoNothing()` for exactly this reason,
  confirmed by reading their own source before writing these fixes, so
  the syntax and idiom used here is consistent with existing, reviewed
  precedent, not a new pattern introduced for this fix.
- **No trading logic, execution safeguard, or portfolio calculation was
  touched** — every changed function reads/writes UI-layout preferences
  (settings, dashboard workspaces, pinned resources) or a plain watchlist
  membership row; none computes a price, a Greek, a risk figure, or an
  order.

## Validation

See the accompanying final report (delivered in-conversation) for full
`typecheck`/backend-test/CI/E2E results, run after these changes.
