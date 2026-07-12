# Phase 1 — Foundation: Execution-Ready Engineering Plan
**DK AI Institutional Investing & Trading OS**
**Status:** Planning only. No code has been written or modified. This document is grounded in direct inspection of the uploaded source — every file path, table name, and code behavior cited below was read from the actual repository, not inferred.

**Hard constraints honored throughout this plan:**
- No changes to options execution logic, kill switch, or guardrail behavior
- No deletions or renames of existing modules
- Every existing table, endpoint, and behavior is preserved unless explicitly called out as changing, with a reason

---

## 1. Exact File-by-File Impact Analysis

### 1.1 New files and folders to be created

| Path | Purpose |
|---|---|
| `lib/auth/` (new package) | Auth/session logic, shared across `api-server` and any future services |
| `lib/auth/src/schema/users.ts` | `users` table definition (also addable directly to `lib/db/src/schema/` — see §3 for the packaging decision) |
| `lib/db/src/schema/users.ts` | The `users` table itself (lives in `lib/db` alongside existing schema files, per current convention — `lib/auth` holds logic, `lib/db` holds schema, matching how the codebase already separates concerns) |
| `lib/db/src/schema/auditLog.ts` | New `platform_audit_log` table (additive — does not touch `autoExecutionLog`) |
| `lib/ai-core/` (new package) | Extracted provider-agnostic AI layer from `coachLLM.ts` |
| `lib/ai-core/src/provider.ts` | Client init, `sk-ant-` prefix detection, model resolution |
| `lib/ai-core/src/complete.ts` | `complete()` / `completeStream()` — provider-agnostic single-shot and streaming calls |
| `lib/ai-core/src/narrate.ts` | Generalized `narrate()` / `narrateStream()` (parameterized system prompt + disclaimer, see §5) |
| `lib/ai-core/src/cache.ts` | Narration cache + single-flight dedup (moved as-is) |
| `lib/ai-core/src/types.ts` | `Narration`, `NarrationSource`, `TokenSink`, `Provider` types |
| `artifacts/api-server/src/middleware/auth.ts` | Verifies session/token, attaches `req.user` |
| `artifacts/api-server/src/middleware/requireAuth.ts` | Route guard — rejects unauthenticated requests |
| `artifacts/api-server/src/lib/tenantScope.ts` | Helper utilities to enforce `userId` scoping consistently across routes (e.g., `scoped(table, userId)`) |
| `artifacts/api-server/src/routes/auth.ts` | Login/signup/session endpoints (exact shape depends on §3 decision) |
| `.env.example` (repo root) | **Does not currently exist anywhere in the repo** — first one needed for onboarding and secrets hygiene |
| `lib/db/manual-migrations/` | Hand-written, versioned SQL scripts for the Phase 1 migrations (see §2 — the project currently has no migrations folder at all) |
| `.github/workflows/ci.yml` (or equivalent) | CI pipeline — none exists today |

### 1.2 Existing files that must change, and why

**Database schema (13 files in `lib/db/src/schema/`) — add `userId` column:**

| File | Why it changes |
|---|---|
| `scannerResults.ts` | Scan parameters (`defaultDte`, `shortDelta`, `minIvRank`) come from `settings`, which is becoming user-scoped — results must follow |
| `trades.ts` | User-owned financial data — the single highest-priority table to scope correctly |
| `backtestResults.ts` | User-triggered, user-parameterized runs |
| `journalEntries.ts` | Personal journal content |
| `aiMessages.ts` | Personal chat history |
| `settings.ts` | **Structural change, not just a column add** — see §2.3, this is the one table where the fix is architectural, not additive |
| `autoExecutionLog.ts` | **Not modified in Phase 1.** Explicitly preserved as-is — see §6 |
| `aiLessons.ts` | Per-user saved coaching content (per `replit.md`: "saved here so the user can revisit") |
| `tradeExplanations.ts` | Tied to a user's exploration of a specific trade |
| `greeksQuizResults.ts` | Per-user learning progress |
| `dailyReports.ts` | Reports are generated from a specific user's portfolio |
| `stockAnalysisHistory.ts` | Flagged as a judgment call, not a certainty — see the owner decision in §2.1 |
| `valueWatchlist.ts` | Explicitly per-user by design |
| `valueQuizResults.ts` | Per-user learning progress |

**`lib/db/src/schema/index.ts`** — add `export * from "./users"` and `export * from "./auditLog"`.

**Backend files that query the database directly (verified via `grep -rl "@workspace/db"` — this is the exact, complete list, not an estimate):**

| File | Why it changes |
|---|---|
| `artifacts/api-server/src/lib/serverState.ts` | Calls `db.select().from(settingsTable).limit(1)` and equivalent trades queries with zero filtering — must accept and apply `userId` |
| `artifacts/api-server/src/lib/execution.ts` | Writes trades/logs — must scope to the executing user |
| `artifacts/api-server/src/lib/autoExecution.ts` | **Behavior-sensitive — see the flagged owner decision in §4.4.** Currently one global scheduler assuming one global settings row |
| `artifacts/api-server/src/lib/autoAdjustment.ts` | Same global-scheduler concern as above |
| `artifacts/api-server/src/lib/tradeClose.ts` | Closes a trade by ID with no ownership check today |
| `artifacts/api-server/src/lib/dailyReport.ts` | Assembles a report from a user's portfolio |
| `artifacts/api-server/src/lib/fundamentals.ts` | Reads `settings` (provider selection) — must resolve per-user settings |
| `artifacts/api-server/src/routes/trades.ts` | **Currently returns every trade in the table to any caller** — the clearest live example of the leak this phase closes |
| `artifacts/api-server/src/routes/settings.ts` | `getOrCreateSettings()` has no user parameter at all today — see §4.5 for the exact current code and what changes |
| `artifacts/api-server/src/routes/scanner.ts` | Scan results and scan-run requests must be scoped |
| `artifacts/api-server/src/routes/portfolio.ts` | Aggregates a user's positions — currently aggregates everyone's |
| `artifacts/api-server/src/routes/portfolioAI.ts` | Reads/writes `dailyReports`, health computed from a user's trades |
| `artifacts/api-server/src/routes/journal.ts` | Personal journal CRUD |
| `artifacts/api-server/src/routes/backtest.ts` | Persists/lists a user's backtest runs |
| `artifacts/api-server/src/routes/ai.ts` | Reads/writes `aiMessages` (chat history) |
| `artifacts/api-server/src/routes/coach.ts` | Reads/writes `aiLessons`, `tradeExplanations`, `greeksQuizResults` |
| `artifacts/api-server/src/routes/stockAnalyst.ts` | Reads/writes `stockAnalysisHistory`, `valueWatchlist`, `valueQuizResults` |

**Test files that reference the DB directly (must be updated to seed a test user and pass `userId`, but their assertions on trading/coach/adjustment logic itself should not change):**
`adjustmentTicket.test.ts`, `autoAdjustment.cycle.test.ts`, `tradeClose.test.ts`, `phase7.coach.test.ts` — 4 files, all under `artifacts/api-server/src/lib/`.

**Bootstrap / cross-cutting:**

| File | Why it changes |
|---|---|
| `artifacts/api-server/src/app.ts` | Mount the new auth middleware. Currently: `pinoHttp` → `cors()` (unrestricted — see §4 leak note) → `express.json()` → routes, with **no auth layer at all** |
| `artifacts/api-server/src/index.ts` | No change to the scheduler's *interval* logic, but `startAutoScheduler()`'s call into `runAutoExecutionCycle()`/`runAutoAdjustmentCycle()` needs to account for §4.4's decision |
| `artifacts/api-server/src/lib/coachLLM.ts` | Refactored to sit on top of `lib/ai-core` — see §5. **Every exported function signature is preserved** so this is invisible to callers on day one |
| `pnpm-workspace.yaml` | Add `lib/auth` and `lib/ai-core` to the `packages:` list (currently: `artifacts/*`, `lib/*`, `lib/integrations/*`, `scripts` — `lib/*` already covers new `lib/` packages automatically, so this may need **no change**, but must be verified once the packages exist) |
| `lib/api-spec/openapi.yaml` | New `/auth/*` endpoints added to the contract; existing endpoints gain an implicit auth requirement (documented via OpenAPI security scheme, not a breaking shape change) |

**Frontend (`artifacts/ravish-trading`) — Phase 1 touches this minimally by design:**

| File | Why it changes |
|---|---|
| New: `src/lib/auth-context.tsx` or equivalent | Holds session state client-side |
| New: `src/pages/Login.tsx` (and Signup, depending on §3 decision) | Entry point for auth |
| `src/App.tsx` | Route guarding — redirect unauthenticated users to login |
| `lib/api-client-react` (generated) | Regenerated via Orval once `openapi.yaml` gains `/auth/*` — **do not hand-edit**, this is codegen output |

**Environment / config:**

| File | Why it changes |
|---|---|
| `.replit` | Confirm `postMerge`/deployment steps still work with new packages; no functional change expected |
| Root `.env.example` (new) | See §7 |

### 1.3 Files explicitly NOT touched in Phase 1

Per the hard constraints: `lib/optionsMath.ts`, `execution.ts`'s risk-validation logic itself (only its DB write gains a `userId`), `adjustment.ts`, `eventRisk.ts`, `earnings.ts`, `risk.ts`, the `autoExecutionLog` schema and every place it's written, and all Coach *content* (prompts, disclaimers, templates) in `coachLLM.ts` — extraction preserves behavior, it does not rewrite prompts or safety logic.

---

## 2. Database Migration Plan

### 2.1 Every existing table, and whether it needs `user_id`

| # | Table | Needs `user_id`? | Rationale |
|---|---|---|---|
| 1 | `scanner_results` | **Yes** | Scan params come from user-scoped settings |
| 2 | `trades` | **Yes** | Core financial data |
| 3 | `backtest_results` | **Yes** | User-triggered runs |
| 4 | `journal_entries` | **Yes** | Personal content |
| 5 | `ai_messages` | **Yes** | Personal chat history |
| 6 | `settings` | **Yes — structural, see §2.3** | Was a true singleton |
| 7 | `auto_execution_log` | **No — out of scope for Phase 1** | See §6 |
| 8 | `ai_lessons` | **Yes** | Per-user saved content |
| 9 | `trade_explanations` | **Yes** | Tied to a user's trade exploration |
| 10 | `greeks_quiz_results` | **Yes** | Per-user progress |
| 11 | `daily_reports` | **Yes** | Generated from a user's portfolio |
| 12 | `stock_analysis_history` | **⚠️ Owner decision — see below** | |
| 13 | `value_watchlist` | **Yes** | Explicitly per-user by the code's own comments |
| 14 | `value_quiz_results` | **Yes** | Per-user progress |

**`stock_analysis_history` needs an owner decision, flagged, not assumed:** the underlying research (e.g., a moat rating for AAPL) is the same regardless of who requested it — it could be a shared cache keyed by symbol+date instead of duplicated per user. Phase 1's default recommendation is to **scope it to `user_id` like everything else** (simplest, safest, consistent with every other table) and revisit a shared-cache optimization later if compute cost becomes a real issue. Building a shared-cache model now would add design complexity to a phase that should stay mechanical.

### 2.2 Proposed `users` table

```
users
├── id            uuid, primary key, default gen_random_uuid()
├── email         text, not null, unique
├── displayName   text, nullable
├── authProvider  text, not null   -- 'password' | 'oauth' | provider name, depends on §3 decision
├── externalId    text, nullable   -- ID from a hosted auth provider, if §3 chooses one
├── passwordHash  text, nullable   -- only populated if self-hosted credential auth is chosen
├── role          text, not null, default 'user'   -- forward-looking, not enforced in Phase 1
├── createdAt     timestamp, not null, default now()
├── updatedAt     timestamp, not null, default now(), on update
```

Uses `uuid` rather than `serial` (unlike every existing table) so user IDs are non-guessable and safe to expose in URLs/tokens — existing tables use `serial` because they were never exposed as tenant boundaries; this is a deliberate, isolated departure from the existing convention, not an inconsistency.

### 2.3 `settings` — the one structural change

**Verified current behavior** (`artifacts/api-server/src/routes/settings.ts`):
```
async function getOrCreateSettings() {
  const existing = await db.select().from(settingsTable).limit(1);
  if (existing.length > 0) return existing[0];
  const [created] = await db.insert(settingsTable).values({...}).returning();
  return created;
}
```
And on update: `db.update(settingsTable).set(parsed.data).returning()` — **no `WHERE` clause at all.** This is not a bug in a single-tenant context (there is only ever one row), but it is the literal definition of a cross-tenant leak the moment a second user exists: today, *any* PATCH to `/settings` updates whichever row happens to exist, and *any* GET returns it, regardless of who's asking.

**Proposed change:**
- Add `userId` (FK to `users.id`, not null) to `settingsTable`
- Add a unique constraint on `userId` (replaces "always row 1" with "always the row for this user" — same one-row-per-owner shape, now correctly scoped)
- `getOrCreateSettings()` becomes `getOrCreateSettings(userId: string)`, with `.where(eq(settingsTable.userId, userId))` added to every select/update
- This is the highest-priority single fix in the whole phase — it is the one place where the current code's leak potential is not theoretical, it's the literal, documented design ("always fetch/update the first row")

### 2.4 Relationships and foreign keys

All 13 user-scoped tables get: `userId: uuid("user_id").notNull().references(() => usersTable.id)`, plus an index on `userId` (every one of these tables will be filtered by `userId` on nearly every query — this is not optional for performance once real usage exists).

**On delete:** `RESTRICT`, not `CASCADE`. Deleting a user should not silently delete their trade history — that's a compliance/audit concern for a financial platform. If user deletion is needed later, it should be a deliberate soft-delete (`deactivatedAt` on `users`) or an explicit data-export-then-purge flow, not a cascading FK.

### 2.5 How existing records are preserved

The repository currently has **no migrations folder and no versioned SQL** anywhere (`lib/db` uses `drizzle-kit push`, a schema-diff-and-apply workflow with no migration history file). This is fine for solo/dev iteration but is not safe for a change that touches every table's data — Phase 1 introduces **hand-written, versioned SQL scripts** in `lib/db/manual-migrations/`, run in order, in addition to (not instead of) the Drizzle schema files, specifically because "add user_id to 13 tables and restructure a singleton" is exactly the kind of change where an auto-diff push tool's behavior should not be trusted blind.

**Nullable → backfill → enforce-not-null strategy, table by table:**

1. **Create `users` table.** No dependents yet, zero risk.
2. **Create one legacy/system user row** to own all pre-existing data (e.g., `owner@dk-os.local`, or an email you specify — this is your existing single-tenant data, which becomes "user #1" rather than being discarded).
3. **For each of the 13 tables:** add `user_id` as **nullable**, no FK constraint yet. Existing rows get `NULL`. The app can still run unmodified at this point — nothing breaks, because nothing queries by `user_id` yet.
4. **Backfill:** `UPDATE <table> SET user_id = '<legacy-user-id>' WHERE user_id IS NULL;` for all 13 tables. Every existing trade, journal entry, and report is now owned by the legacy user — nothing is lost or orphaned.
5. **Enforce:** `ALTER TABLE <table> ALTER COLUMN user_id SET NOT NULL;` then add the FK constraint and index. Only done after step 4 is verified complete (a `SELECT COUNT(*) WHERE user_id IS NULL` returning `0` on every table is the gate before this step runs).
6. **`settings` gets the additional unique-constraint step** described in §2.3, and the application code change (`getOrCreateSettings(userId)`) must ship in the **same deploy** as step 6 — this is the one step where schema and code must move together, because a nullable→not-null settings column with no matching code change would break every request.
7. **Application code deploys** (route/lib file updates from §1.2) — only after steps 1–6 are confirmed on the target database.

### 2.6 Rollback steps

Because this uses hand-written SQL (not Drizzle's auto-generated migration history), rollback is a hand-written down-script per step, not a single "undo" command:

- **After step 3 (nullable columns added):** `ALTER TABLE <table> DROP COLUMN user_id;` — zero data loss, since nothing depended on it yet.
- **After step 4 (backfilled):** Same drop-column rollback — the backfill only populated a column nothing reads yet.
- **After step 5 (NOT NULL + FK enforced):** Rollback requires dropping the FK constraint and NOT NULL constraint before dropping the column (`ALTER TABLE ... DROP CONSTRAINT ...; ALTER TABLE ... ALTER COLUMN user_id DROP NOT NULL;` then drop column) — still zero application data loss, since `user_id` values are simply discarded, not the rows themselves.
- **After step 6 (settings restructured + app code deployed):** This is the only step where rollback requires **coordinated code + schema rollback** — redeploy the previous app version *and* revert the schema in the same window, because the new code assumes `userId`-scoped settings and the old code assumes singleton settings. This step should have the smallest possible deploy window and a tested rollback rehearsed on a staging copy before it touches real data.
- **Full safety net:** take a `pg_dump` of the database immediately before step 3 begins, independent of the above per-step rollbacks — this is a financial platform's transaction history; a full backup before touching every table is non-negotiable regardless of how careful the incremental rollback plan is.

---

## 3. Authentication Decision

**Stack constraints this must fit:** TypeScript, React 19, Express 5, PostgreSQL + Drizzle ORM, currently deployed on Replit (autoscale), pnpm workspace monorepo.

| Option | Fit for this stack | Cost | Security | Implementation complexity | Future scalability |
|---|---|---|---|---|---|
| **Roll your own** (bcrypt + express-session + `connect-pg-simple`) | Good — no new infra, uses existing Postgres | Free | Depends entirely on your team getting session/password handling right — highest risk of subtle bugs (session fixation, timing attacks, password reset flows) | High — you're building and maintaining a security-critical subsystem from scratch | Full control, but every future auth feature (OAuth, SSO, MFA) is more DIY work |
| **Better-Auth** (self-hosted, TypeScript-native) | **Strong fit** — has official Drizzle adapter, works with Express, no vendor lock-in, open source | Free (self-hosted, no per-user pricing) | Actively maintained, handles session/password/OAuth correctly out of the box — meaningfully lower risk than rolling your own | Medium — integration work, but the hard security primitives are handled for you | Excellent — adding OAuth providers, MFA, or org/team features later is configuration, not a rewrite |
| **Clerk** (hosted, managed) | Good — drop-in React components, Express middleware available | Free tier (~10k MAU), then per-MAU pricing | Very strong — managed security posture, SOC2, this is Clerk's entire business | **Lowest** — fastest to ship, most of the UI is provided | Very good, but you're now dependent on a third-party service being up and priced acceptably as you scale — real cost at scale for a platform with automation running 24/7 |
| **Auth0 / Okta** | Good, but heavier than this project currently needs | Higher — enterprise pricing tiers | Excellent, enterprise-grade | Medium | Best-in-class for large orgs, SSO, compliance — likely overkill for where this platform is today |
| **Replit Auth** | Native to current hosting (the `REPL_ID` env var already present suggests this was at least considered) | Free within Replit | Reasonable for Replit-hosted apps | Lowest of all options, if staying on Replit | **Weakest** — couples authentication itself to the hosting platform, compounding the existing Replit coupling risk already flagged in the original audit (Q6) |

**Recommendation: Better-Auth**, self-hosted on the existing Postgres instance via its Drizzle adapter.

**Why:** this platform's stated long-term ambition is an "enterprise-grade" OS handling real financial automation — that argues against both the DIY option (too much security surface to own for something this consequential) and against permanent dependency on a third-party auth vendor's uptime and pricing for a system that includes 24/7 automated trade execution. Better-Auth gives you the security correctness of a managed solution without the recurring cost or platform dependency, and it fits the existing TypeScript/Drizzle/Express stack with no impedance mismatch.

**If speed-to-first-user matters more than long-term independence**, Clerk is the legitimate fast alternative — flag this as a real trade-off for the owner to weigh, not a wrong choice.

**Not recommending Replit Auth** as the long-term answer, given the existing platform-coupling risk already on record from the original audit — using it as a *temporary* shortcut during early Phase 1 development is reasonable if you want to unblock other work, but it should not be the system you build multi-tenancy on top of permanently.

**This decision is not implemented in this phase** — it is presented for your approval before any auth code is written (see Owner Decisions, §11).

---

## 4. Multi-Tenancy Rules

### 4.1 Data isolation rule

Every table in §2.1 marked "Yes" has a `userId` column that is **never nullable and never optional in a query.** No route may `SELECT`, `UPDATE`, or `DELETE` against any of these 13 tables without a `WHERE user_id = :currentUser` predicate (or an equivalent `.where(eq(table.userId, userId))` in Drizzle). This is a hard rule, not a guideline — see `lib/tenantScope.ts` in §1.1, whose job is to make the scoped pattern the *only* easy way to write a query, so an unscoped query has to be a deliberate, visible exception rather than an easy mistake.

### 4.2 Server-side authorization requirements

Two layers, not one:
1. **Authentication layer** (`middleware/auth.ts`): verifies the session/token and attaches `req.user`. Runs before every route except `/healthz` and `/auth/*` itself.
2. **Ownership layer**: for any endpoint that fetches a *specific record by ID* (e.g., `GET /trades/:id`, `DELETE /trades/:id`), the query itself must include the `userId` filter — **not** "fetch by ID, then check if `row.userId === req.user.id`." Filtering in the query prevents both data leakage and timing-based ID enumeration; a fetch-then-check pattern can accidentally leak existence/shape information even when it correctly denies access.

### 4.3 How every query gets scoped — the mechanical pattern

Every one of the 21 files listed in §1.2 that touches `@workspace/db` follows the same shape:
- **Before:** `db.select().from(tradesTable)`
- **After:** `db.select().from(tradesTable).where(eq(tradesTable.userId, req.user.id))`

For writes: **Before:** `db.insert(tradesTable).values({...})` → **After:** `db.insert(tradesTable).values({...userId: req.user.id})`.

This is mechanical and low-risk *per query* — the risk in this phase is coverage, not difficulty: missing even one of the ~20+ query sites in these 21 files reintroduces a leak. This is exactly why §9's sprint plan treats "add user_id to schema" and "scope every query" as separate, sequential sprints with a specific test gate between them (see §8), rather than one big-bang change.

### 4.4 ⚠️ The one query-scoping problem that isn't mechanical — the automation scheduler

**Verified from `artifacts/api-server/src/index.ts`:** `startAutoScheduler()` runs a single `setInterval` for the entire server process, calling `runAutoExecutionCycle()` and `runAutoAdjustmentCycle()` globally, once every 60 seconds. These functions currently assume **one global settings row** (the kill switch, guardrails, and mode all come from the single `settings` table).

Once `settings` is user-scoped, "the kill switch" is no longer a single global switch — it's one kill switch **per user**. The scheduler must become either:
- **(a)** one loop that iterates all users with `autoExecuteEnabled = true` and runs a cycle per user, re-checking that specific user's guardrails, or
- **(b)** re-architected into per-user scheduled jobs.

**This is flagged as an owner decision (§11), not a default assumption** — it is the single most consequence-sensitive design choice in Phase 1, because it touches the exact automation code the project rules say must not change behavior. The safe path is: this decision is made and reviewed **before** any code in `autoExecution.ts`/`autoAdjustment.ts` is touched, and the change, when it happens, is scoped as its own sprint with the existing guardrail tests (`phase6.test.ts`, `phase9.eventRisk.test.ts`, `autoAdjustment.cycle.test.ts`) as a hard gate — not folded into the general "add user_id everywhere" sprint.

### 4.5 Endpoints that leak data today (pre-multi-tenancy) and must be fixed in lockstep with the schema change

Verified by reading the actual route handlers, not inferred:

| Endpoint | Current behavior | Why it leaks once a second user exists |
|---|---|---|
| `GET /settings`, `PATCH /settings` | `getOrCreateSettings()` — no user parameter, `.limit(1)` with no `WHERE` | Every user sees and can overwrite the same settings row — includes execution mode, risk limits, and the automation kill switch itself |
| `GET /trades`, `GET /trades/:id`, `DELETE /trades/:id` | Query `tradesTable` with no owner filter | Every user sees every user's trade history and P&L; any user can close another user's position by guessing/incrementing an ID |
| `GET /scanner/results`, `POST /scanner/run` | Global table, wiped and regenerated on every run ("safe for demo seeding" per `replit.md` — correct for single-tenant, not for multi-tenant) | One user running a scan wipes and replaces the results every other user is looking at |
| `GET /portfolio/*` | Aggregates from `tradesTable` with no filter | Portfolio Greeks/summary would blend every user's positions together |
| `GET/POST /journal`, `GET/PATCH /journal/:id` | No owner filter | Personal journal entries visible/editable across accounts |
| `GET/POST /backtest/*` | No owner filter | One user's backtest history visible to all |
| `GET/POST /ai/messages`, `/ai/chat` | No owner filter on `aiMessages` | Chat history shared across accounts |
| `GET/POST /coach/*` persisted content | No owner filter on `aiLessons`, `tradeExplanations`, `greeksQuizResults` | Learning progress and saved explanations shared across accounts |
| `GET/POST /stock-analyst/*` | No owner filter on `valueWatchlist`, `valueQuizResults`, `stockAnalysisHistory` | Personal watchlist shared across accounts |
| `GET /portfolio/health`, `/briefing`, `/reports*` | No owner filter | Daily reports generated from — and visible to — every account |

**Every route above is currently correct for a single-tenant application.** None of this is "sloppy code" — it's the expected shape of code written before multi-tenancy was a requirement. Listing them here is the actionable checklist for §9's sprint work, not a criticism of the existing implementation.

**Also verified:** `app.ts` calls `cors()` with no configuration, meaning any origin can currently call the API. This is a separate, smaller hardening item worth fixing alongside auth (restrict to the known frontend origin(s)) — flagged here, addressed in §9.

---

## 5. Shared AI Layer Extraction

### 5.1 What moves to `lib/ai-core` (provider-agnostic, engine-agnostic)

Verified from the full 816-line `coachLLM.ts`, these pieces have zero options-specific content and move as-is:

- `init()`, `llmAvailable()` — API key detection (`sk-ant-` prefix → Anthropic, else OpenAI), client construction
- `complete()` / `completeStream()` — the unified single-shot and streaming call across both providers, including the `AbortController`-based timeout (`withTimeout`)
- The narration cache (`narrationCache`, `cacheGet`/`cacheSet`, LRU eviction, TTL) and the single-flight `inflight` map
- `extractJsonObject()` — the JSON-fence-stripping helper for structured LLM responses
- Core types: `Provider`, `Narration`, `NarrationSource`, `TokenSink`, `CoachLevel`, `levelInstruction()`/`levelKey()`

### 5.2 What must be generalized, not just moved

The current `narrate()`/`narrateStream()` functions **hardcode** two options-specific things: the `SYSTEM_PROMPT` constant ("You are the Ravish Trading Coach...") and `enforceDisclaimer()`'s hardcoded `COACH_DISCLAIMER`. To be genuinely shared across three engines, both must become parameters:

```
// lib/ai-core's generalized signature (illustrative shape, not final code):
narrate(prompt, data, fallback, {
  systemPrompt: string,      // was hardcoded SYSTEM_PROMPT
  disclaimer: string,        // was hardcoded COACH_DISCLAIMER
  cacheKey?: string,
  bustCache?: boolean,
})
```

This is the one real design change in the extraction — everything else is a lift-and-shift. It's a small change with a large payoff: it's exactly what makes `enforceDisclaimer()`'s safety guarantee ("every narration carries its disclaimer, enforced centrally, not per-caller") apply to the Investing and Trading coaches too, instead of being reinvented per engine.

### 5.3 What stays in the options engine's own file (domain-specific)

`coachLLM.ts` keeps everything that's actually about options coaching: `SYSTEM_PROMPT`'s specific wording, `tradeTemplate()`/`adjustmentTemplate()`/`greekTemplate()`/`reviewTemplate()`, the specific prompts (`TRADE_PROMPT`, `ADJUSTMENT_PROMPT`, `marketBriefingPrompt`, `valueResearchPrompt`), and the value-module-specific `violatesAntiImpersonation()` / `enforceValueSafety()` safety check (this is arguably generic enough to offer as an optional `ai-core` utility for any future persona-based prompt, but Phase 1 keeps it where it is to avoid over-engineering the extraction — a candidate for Phase 2, not Phase 1).

**After extraction, `coachLLM.ts` becomes a thin domain layer on top of `lib/ai-core`** — same exported function names (`narrateTradeExplanation`, `narrateAdjustment`, `narrateGreekLesson`, `narrateJournalReview`, `narrateMarketBriefing`, `narrateValueResearch`, and their `*Stream` counterparts), same behavior, same disclaimer guarantees — **every existing caller in `routes/trades.ts`, `routes/coach.ts`, etc. needs zero changes.**

### 5.4 How the three engines use it going forward

- **Options Income Coach** (existing): `coachLLM.ts`, as described above — the reference implementation
- **Trading Coach** (Phase 3, future): a new `artifacts/api-server/src/lib/tradeCoachLLM.ts` (or `engines/trading/lib/coachLLM.ts` once the monorepo restructure lands) importing `lib/ai-core`'s `narrate()`, supplying its own `SYSTEM_PROMPT` and disclaimer text
- **Investing Research Assistant** (Phase 2, future): similarly, a thin domain layer over `lib/ai-core`, reusing `valueSchool.ts`'s existing prompt patterns as a starting point

All three share: provider detection, the timeout/cache/single-flight machinery, and the disclaimer-enforcement guarantee — the exact things that are hard to get right and are already proven correct in the current options implementation. None of them share prompt wording or domain templates, which is correct — that's what makes them different coaches.

---

## 6. Audit-Log Design

### 6.1 What is preserved, unchanged

**`autoExecutionLog` (table, schema, and every write site) is not modified in Phase 1.** Verified current shape:
```
auto_execution_log: id, runId, kind (open|adjust), decision (executed|skipped|rejected|blocked),
reason, symbol, strategy, ravishScore, tradeId, alpacaOrderId, createdAt
```
This table is the audit trail behind the full-auto execution kill switch and guardrails — per the hard constraints on this phase, it is not touched, not migrated, not merged into the new table. It keeps recording exactly what it does today.

### 6.2 New, additive table: `platform_audit_log`

A generalized audit log for the *platform* — every engine's user-facing actions, not just options automation:

```
platform_audit_log
├── id            serial, primary key
├── userId        uuid, FK users.id, nullable (nullable specifically for system-level
│                  events with no acting user — e.g., a scheduled job's own lifecycle,
│                  not any per-user action within it)
├── engine        text  -- 'options_income' | 'trading' | 'investing' | 'platform'
├── eventType     text  -- e.g. 'trade.created', 'trade.closed', 'settings.updated',
│                          'auth.login', 'auth.login_failed', 'research.generated',
│                          'watchlist.updated'
├── action        text  -- mirrors autoExecutionLog's "decision" vocabulary where it
│                          applies: created | updated | deleted | executed | viewed |
│                          rejected | blocked
├── result        text  -- 'success' | 'failure' | 'blocked'
├── resourceType  text, nullable   -- 'trade' | 'report' | 'watchlist_item' | 'settings' ...
├── resourceId    text, nullable
├── reason        text, nullable   -- mirrors autoExecutionLog's reason field
├── runId         text, nullable   -- preserves the batch/cycle-correlation concept for
│                                     any future automated (non-options) engine
├── metadata      jsonb, not null, default '{}'   -- structured, engine-specific payload
├── createdAt     timestamp, not null, default now()
```

**Indexes:** `(userId, createdAt)` and `(engine, eventType, createdAt)` — the two access patterns this table will actually serve (a user's own activity history, and an operator's cross-user view by event type).

### 6.3 What Phase 1 does and does not do with this table

**Does:** create the table; wire it into the new `auth` events (login, login failure, session created) and into the multi-tenancy work itself (e.g., `settings.updated` events, so the newly-scoped settings changes are auditable from day one).

**Does not:** retrofit every existing route to write to it. That's real, valuable work, but it's additive scope beyond "Foundation" — Phase 1's job is to build the table and prove the pattern on the new auth surface, not to instrument the entire existing product. Extending it to trades/journal/research write-paths is a natural, low-risk Phase 2/3/4 task once each engine's owning team is doing that work anyway.

**Never:** does this design imply consolidating `autoExecutionLog` into `platform_audit_log` in Phase 1. If that consolidation is ever wanted, it is its own future, carefully-scoped change to the automation logging path — explicitly out of scope here.

---

## 7. Secrets and Environment Variables

### 7.1 Complete inventory of current environment variables (verified via `grep -r process.env` — no values inspected or exposed)

| Variable | Used in | Purpose |
|---|---|---|
| `DATABASE_URL` | `lib/db/src/index.ts`, `drizzle.config.ts` | Postgres connection |
| `ALPACA_API_KEY` | `providers/alpacaProvider.ts` | Brokerage — has a fallback to a per-settings-row key (see §7.2) |
| `ALPACA_API_SECRET` | `providers/alpacaProvider.ts` | Brokerage |
| `FMP_API_KEY` | `lib/fundamentals.ts` | Live fundamentals provider |
| `ALPHA_VANTAGE_API_KEY` | `lib/fundamentals.ts` | Live fundamentals provider (fallback) |
| `OPENAI_API_KEY` | `lib/coachLLM.ts` | **Overloaded — see §7.3** |
| `OPENAI_COACH_MODEL` | `lib/coachLLM.ts` | Model override, OpenAI path |
| `ANTHROPIC_COACH_MODEL` | `lib/coachLLM.ts` | Model override, Anthropic path |
| `COACH_LLM_TIMEOUT_MS` | `lib/coachLLM.ts` | Per-call timeout |
| `LOG_LEVEL` | `lib/logger.ts` (inferred from usage) | pino log level |
| `NODE_ENV` | build/runtime | Standard |
| `PORT` | `index.ts` | Required, throws if missing |
| `BASE_PATH` | (found via grep, not yet traced to a specific file in this pass) | Flagged for verification, not confirmed |
| `REPL_ID` | (found via grep) | Replit platform coupling |

### 7.2 Verified findings worth flagging explicitly

- **`OPENAI_API_KEY` is confirmed, by reading `coachLLM.ts`'s `init()` directly, to sometimes hold an Anthropic key** — the code checks `key.startsWith("sk-ant-")` and routes to the Anthropic SDK if so. This is a real, working mechanism, not a bug — but it's a naming trap for anyone new to the codebase, and a false positive for any secrets-scanning tool that flags "Anthropic key stored under an OpenAI-named variable" as a misconfiguration.
- **`ALPACA_API_KEY`'s fallback is worth knowing about, not just fixing:** `alpacaProvider.ts` reads `process.env.ALPACA_API_KEY ?? settingsApiKey ?? ""` — meaning a user's Alpaca key can already come from their own `settings` row instead of a global env var. This is a genuinely useful existing pattern for multi-tenancy (each user can already bring their own brokerage key via Settings) and should be preserved, not "fixed away," when `settings` becomes user-scoped.
- **`polygonProvider.ts` reads no environment variable at all** — verified by direct inspection, not assumed. The file exists and implements the provider interface, but has no credential wiring. This means Polygon market data is currently a stub, not a working integration — worth knowing before Phase 1 assumes any live-data path is closer to working than it is.
- **No `.env.example` file exists anywhere in the repository** (`find . -iname ".env*"` returns nothing) — this is a real onboarding gap independent of the naming issue.

### 7.3 Proposed clean naming standard

Grouped by domain, each domain's variables share a prefix, provider-specific credentials are never shared across providers:

```
# Core
DATABASE_URL=
NODE_ENV=
PORT=
BASE_PATH=
LOG_LEVEL=

# Auth (exact variables depend on the §3 decision — illustrative if Better-Auth)
AUTH_SECRET=
SESSION_SECRET=

# AI providers — no more sharing one variable between two providers
ANTHROPIC_API_KEY=
ANTHROPIC_COACH_MODEL=
OPENAI_API_KEY=
OPENAI_COACH_MODEL=
AI_LLM_TIMEOUT_MS=          # renamed from COACH_LLM_TIMEOUT_MS — engine-agnostic once lib/ai-core exists

# Brokerage
ALPACA_API_KEY=
ALPACA_API_SECRET=

# Market data
POLYGON_API_KEY=            # currently unused by polygonProvider.ts — added when that
                             # integration is actually wired, not before

# Fundamentals
FMP_API_KEY=
ALPHA_VANTAGE_API_KEY=

# Platform (isolate Replit-specific coupling clearly, don't mix with app config)
REPL_ID=
```

**Migration approach for the `OPENAI_API_KEY` overload specifically:** support both the new `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` (correctly separated) and the legacy overloaded `OPENAI_API_KEY` (prefix-sniffed) simultaneously for one deprecation window, with a startup log warning if the legacy path is in use, then remove the prefix-sniffing fallback entirely in a later phase. This avoids a hard cutover that could silently disable the coach if the env var rename is missed during deploy.

**No secret values are included anywhere in this document, per the task's instructions — only variable names, purposes, and file locations.**

---

## 8. Testing and Safety Gates

### 8.1 Current test suite (verified count and location)

21 test files total. The ones most relevant to Phase 1's blast radius:

| File | What it protects |
|---|---|
| `phase6.test.ts` | Full-auto execution engine — the kill switch and guardrails |
| `phase9.eventRisk.test.ts` | Event-risk blocking rules |
| `phase8.adjustment.test.ts` | Signed-gap threat detection (a documented past bug class — see original audit) |
| `autoAdjustment.cycle.test.ts` | Auto-adjustment safety invariants (single-flight, live re-check) |
| `adjustmentTicket.test.ts`, `tradeClose.test.ts` | Trade lifecycle correctness |
| `phase7.coach.test.ts`, `coach-safety.test.ts`-equivalent (`coach-level.test.ts`, `coach-slowload.test.ts`) | Coach disclaimer and behavior invariants |
| `phase10.performance.test.ts` | Performance analytics engine |
| `phase4.test.ts`, `phase5.test.ts` | Scanner/execution math |
| `value.test.ts`, `fundamentals-freshness.test.ts` | Investing/value module correctness |
| `page-test-pattern.guardrail.test.ts` | A meta-test enforcing a consistent frontend test pattern — genuinely useful convention to extend, not replace |

### 8.2 What must pass before each migration step

- **Before any schema change (§2.5 steps 1–5):** the full existing suite (`pnpm --filter @workspace/api-server run test`) must pass on the unmodified schema, establishing the baseline.
- **After each nullable-column-add step:** the full suite must still pass unmodified — if adding a nullable column with no app-code change breaks any test, that's a signal something in the ORM layer or generated types needs attention *before* proceeding, not after.
- **Before the `settings` NOT NULL enforcement (§2.5 step 6):** a **new** test verifying `getOrCreateSettings(userId)` correctly creates/returns per-user rows must exist and pass, alongside every existing settings-dependent test (execution mode gating, guardrail settings reads) continuing to pass unmodified in their behavior — same values in, same values out, just scoped correctly.
- **After scoping every query (§9's dedicated sprint):** every one of the 21 existing tests must still pass with **zero changes to their assertions** — only their setup (seeding a test user, passing `userId` through) should change. If a test's *expected result* needs to change to pass, that's a signal behavior shifted, which the hard constraints for this phase forbid for anything execution/guardrail-related.

### 8.3 New tests required for this phase specifically

- **Authentication:** login success/failure, session verification, expired/invalid token rejection, password hashing correctness (if self-hosted) or provider callback handling (if hosted)
- **Tenant isolation (the most important new test category):** for every one of the 13 user-scoped tables, a test that seeds two users with data and asserts User A's request **never** returns User B's rows — this should be written once as a **shared test helper** (`assertTenantIsolation(table, routeUnderTest)`) and applied across all 13, not hand-written 13 times inconsistently
- **Authorization / IDOR:** for every "fetch by ID" endpoint (`GET /trades/:id`, `DELETE /trades/:id`, etc.), a test asserting that requesting another user's resource ID returns 404 (not 403 — returning 403 confirms the resource exists, which is its own small leak) rather than the resource
- **Settings singleton → per-user regression test:** explicit test that two users' settings (including their respective automation kill switches) are fully independent — this directly protects the exact risk called out in §2.3 and §4.5

### 8.4 What must NOT change behavior — the explicit non-regression list

Per the hard constraints, these existing test files' *assertions* must remain word-for-word identical before and after Phase 1 — only their setup/seeding may change:
`phase6.test.ts`, `phase9.eventRisk.test.ts`, `phase8.adjustment.test.ts`, `autoAdjustment.cycle.test.ts`, `adjustmentTicket.test.ts`, `tradeClose.test.ts`. If any of these needs an assertion change to pass, that is treated as a stop-the-line signal, not a test update to wave through.

---

## 9. Sprint Breakdown

Each sprint sized to be independently shippable and independently revertible — no sprint depends on a future sprint to be safe to deploy on its own.

### Sprint 1 — Users table + CI pipeline (no behavior change)
- **Goal:** Stand up the `users` table and get automated testing running, with zero impact on any existing route or user-facing behavior.
- **Tasks:** Create `lib/db/src/schema/users.ts`; create the legacy/system user row plan (script, not yet run against real data); wire `pnpm run typecheck && pnpm run build && pnpm test` into CI.
- **Files affected:** `lib/db/src/schema/users.ts`, `lib/db/src/schema/index.ts`, new `.github/workflows/ci.yml`.
- **Tests required:** Full existing suite passes unmodified (baseline proof this sprint changed nothing observable).
- **Acceptance criteria:** CI runs on every PR; `users` table exists in a dev database; zero existing route behavior changed (verified by full suite + manual smoke test of Settings and Trades pages).
- **Rollback:** Drop the `users` table; remove the CI workflow file. No dependent code exists yet, so this is a clean, zero-risk revert.
- **Risk level:** **Low.**

### Sprint 2 — `.env.example`, secrets naming migration (additive, non-breaking)
- **Goal:** Ship the new, correctly-separated env var names alongside the existing ones (§7.3), with the legacy `OPENAI_API_KEY` overload still working during the deprecation window.
- **Tasks:** Create `.env.example`; add support for `ANTHROPIC_API_KEY`/split `OPENAI_API_KEY` in `coachLLM.ts`'s `init()` with a fallback to the legacy prefix-sniffed behavior and a startup warning log if the legacy path fires.
- **Files affected:** `.env.example` (new), `artifacts/api-server/src/lib/coachLLM.ts` (`init()` only).
- **Tests required:** New test confirming both the new and legacy env var paths correctly select the Anthropic vs OpenAI client; existing `phase7.coach.test.ts` passes unmodified.
- **Acceptance criteria:** Coach works identically whether the deployment uses old or new variable names.
- **Rollback:** Revert `init()` to read only the legacy variable — since the legacy path is preserved, not removed, this sprint is safe to ship without a hard cutover risk.
- **Risk level:** **Low.**

### Sprint 3 — Nullable `user_id` columns on all 13 tables (additive, non-breaking)
- **Goal:** Add nullable `user_id` to every table in §2.1, with no application code reading or writing it yet.
- **Tasks:** Write and run the hand-written SQL from §2.5 steps 3; update the 13 Drizzle schema files.
- **Files affected:** The 13 schema files listed in §1.2; `lib/db/manual-migrations/001_add_user_id_nullable.sql`.
- **Tests required:** Full existing suite passes unmodified — this is the key gate for this sprint (per §8.2).
- **Acceptance criteria:** Every table has the column; every existing feature works identically; `pg_dump` backup taken and verified restorable before this sprint runs against anything beyond a dev database.
- **Rollback:** Drop the 13 columns (§2.6) — zero data loss, since no row's `user_id` is depended on yet.
- **Risk level:** **Medium** (touches every table's schema, even though behavior is unchanged — the risk is mechanical/operational, not logical).

### Sprint 4 — Backfill legacy user, enforce NOT NULL + FKs (except `settings`)
- **Goal:** Complete the migration on the 12 non-`settings` tables — backfill, enforce, index.
- **Tasks:** Run backfill SQL (§2.5 step 4) for the 12 tables; run enforcement SQL (step 5); add indexes.
- **Files affected:** `lib/db/manual-migrations/002_backfill_and_enforce.sql`; the 12 corresponding schema files updated to mark the column `.notNull()`.
- **Tests required:** Full suite passes unmodified — no application code reads `user_id` yet, so behavior is still identical; a new verification query (`SELECT COUNT(*) WHERE user_id IS NULL` = 0 on all 12 tables) gates this sprint's deploy.
- **Acceptance criteria:** All 12 tables have enforced, indexed, backfilled `user_id`; zero orphaned rows; existing suite green.
- **Rollback:** Per §2.6's step-5 rollback — drop constraints, then column, per table. More involved than Sprint 3's rollback but still zero application-data loss.
- **Risk level:** **Medium-High** (this is where a mistake would be most expensive to unwind, even though the change itself is still additive from the application's point of view).

### Sprint 5 — `settings` singleton → per-user (schema + code, shipped together)
- **Goal:** The one sprint where schema and application code change together, per §2.5 step 6.
- **Tasks:** Add `user_id` + unique constraint to `settings`; rewrite `getOrCreateSettings()` to take `userId`; update `routes/settings.ts` and every internal caller (`serverState.ts`, `fundamentals.ts`).
- **Files affected:** `lib/db/src/schema/settings.ts`, `artifacts/api-server/src/routes/settings.ts`, `artifacts/api-server/src/lib/serverState.ts`, `artifacts/api-server/src/lib/fundamentals.ts`.
- **Tests required:** New per-user settings isolation test (§8.3); every existing settings-dependent test passes with unmodified assertions.
- **Acceptance criteria:** Two users have fully independent settings, including independent automation kill switches; no existing test's expected values changed.
- **Rollback:** Coordinated code+schema rollback rehearsed on staging first, per §2.6 — this sprint should have the shortest possible deploy window of the whole phase.
- **Risk level:** **High** (the only sprint touching the automation-adjacent settings surface — treat with the same care as the automation code itself, even though the automation code isn't directly modified here).

### Sprint 6 — Authentication implementation (per §3's approved decision)
- **Goal:** Ship real login/session handling, per whichever option is approved in §11.
- **Tasks:** Depends entirely on the chosen option — not detailed further here pending that decision.
- **Files affected:** New `lib/auth/`, `middleware/auth.ts`, `middleware/requireAuth.ts`, `routes/auth.ts`, frontend login page.
- **Tests required:** Full auth test category from §8.3.
- **Acceptance criteria:** A real user can sign up, log in, and receive a session that `req.user` correctly reflects on subsequent requests.
- **Rollback:** Auth middleware ships disabled-by-default (feature-flagged) until Sprint 7 requires it, so this sprint alone is low-risk to deploy and easy to disable if issues surface.
- **Risk level:** **Medium** (new subsystem, but isolated — nothing else depends on it being correct yet).

### Sprint 7 — Scope every route query by `userId` (the leak-closing sprint)
- **Goal:** Apply the §4.5 fix list — every route in that table gets its queries scoped.
- **Tasks:** Update all 16 route/lib files from §1.2's route table, using the `tenantScope.ts` helper from Sprint 6 (or built here if not needed earlier).
- **Files affected:** All files in §4.5's table, plus `execution.ts`, `tradeClose.ts`, `dailyReport.ts`.
- **Tests required:** Full tenant-isolation test suite from §8.3 (all 13 tables); full existing suite with unmodified assertions (§8.4's non-regression list is the hard gate here).
- **Acceptance criteria:** Two test users, full smoke test across every page, zero cross-user data visible anywhere; §8.4's list passes with zero assertion changes.
- **Rollback:** Feature-flag the auth requirement (from Sprint 6) so it can be disabled, reverting to today's single-tenant-shaped behavior, without a schema rollback — the schema supports both states.
- **Risk level:** **High** (largest surface area of any sprint — mitigated by being the last sprint in the sequence, after every lower-risk piece is already proven).

### Sprint 8 — Automation scheduler multi-tenancy (only after §11's decision is made)
- **Goal:** Resolve §4.4 — make the full-auto scheduler correctly per-user.
- **Tasks:** Entirely dependent on the owner decision in §11; not detailed further here.
- **Files affected:** `autoExecution.ts`, `autoAdjustment.ts`, `index.ts`.
- **Tests required:** `phase6.test.ts`, `phase9.eventRisk.test.ts`, `autoAdjustment.cycle.test.ts` pass with **zero assertion changes** — this is the hardest non-regression bar in the entire phase, given the explicit instruction not to touch kill-switch/guardrail behavior.
- **Acceptance criteria:** Two users with independently-armed kill switches behave completely independently; a disarmed user's positions are never touched by another user's armed cycle.
- **Rollback:** This sprint should not proceed to production without a staging rehearsal specifically exercising two concurrent armed users — rollback plan is a full revert to the pre-sprint scheduler code, kept deployable as a single revert commit, not a partial one.
- **Risk level:** **Highest in the entire phase.** Recommend this be the last sprint, run only once Sprints 1–7 are stable in production, and reviewed by more than one engineer before merge.

### Sprint 9 — `lib/ai-core` extraction
- **Goal:** Execute §5's extraction.
- **Tasks:** Create `lib/ai-core` package; move the provider-agnostic pieces; generalize `narrate()`/`narrateStream()`'s signature; refactor `coachLLM.ts` to sit on top of it with identical exported behavior.
- **Files affected:** New `lib/ai-core/*`; `artifacts/api-server/src/lib/coachLLM.ts`.
- **Tests required:** `phase7.coach.test.ts`, `coach-level.test.ts`, `coach-slowload.test.ts` pass with **zero assertion changes**; new unit tests for `lib/ai-core` in isolation.
- **Acceptance criteria:** Every existing coach endpoint behaves identically (same disclaimer guarantees, same caching/timeout behavior); `lib/ai-core` is independently unit-testable without any options-specific fixtures.
- **Rollback:** Since `coachLLM.ts`'s public exports are unchanged, this sprint can be reverted by restoring the previous `coachLLM.ts` file wholesale — no downstream files need to change either direction.
- **Risk level:** **Medium** (large diff, but mechanically verifiable — the non-regression test list makes "did I break anything" a yes/no answer, not a judgment call).

### Sprint 10 — `platform_audit_log` table + auth event wiring
- **Goal:** Execute §6.
- **Tasks:** Create the table; wire `auth.login`/`auth.login_failed`/`settings.updated` events.
- **Files affected:** New `lib/db/src/schema/auditLog.ts`; `routes/auth.ts`; `routes/settings.ts`.
- **Tests required:** New tests confirming audit rows are written on login/settings-change; confirm zero writes to `autoExecutionLog` from any new code path.
- **Acceptance criteria:** Audit trail visible for the new auth surface; `autoExecutionLog` behavior is provably untouched (a test asserting its row count is unaffected by any Phase 1 action other than existing automation runs).
- **Rollback:** Drop the new table; remove the write calls — fully additive, so this is a clean revert.
- **Risk level:** **Low.**

### Sprint 11 — Monorepo restructure prep
- **Goal:** Prepare (not necessarily complete) the `platform/ / engines/ / apps/` structure from the original blueprint, without moving any file that would break an import path mid-phase.
- **Tasks:** Add the new top-level folders; document the target layout; move only the genuinely new Phase 1 packages (`lib/auth`, `lib/ai-core`) into their final homes, leaving existing `artifacts/*` untouched for now (a full restructure of working code is explicitly deferred to avoid the "don't rebuild" constraint being violated by a well-intentioned reorg).
- **Files affected:** New folders only; no existing file moved.
- **Tests required:** Full suite passes unmodified (proves the prep work touched nothing load-bearing).
- **Acceptance criteria:** New packages live in their target locations; existing structure is undisturbed.
- **Rollback:** Remove the new folders — nothing else depends on their existence yet.
- **Risk level:** **Low.**

---

## 10. First Implementation Package — Recommendation

**Sprint 1 + Sprint 2, combined, is the recommended first coding package.**

**Why this pairing specifically:**
- **Zero risk to the options engine.** Neither sprint touches a single trading, execution, scanner, or automation file's *logic* — Sprint 2 touches exactly one function (`coachLLM.ts`'s `init()`), and only to add a fallback path, with the legacy behavior fully preserved.
- **Produces immediately visible, demonstrable progress:** a working CI pipeline (green checks on every PR — visible proof of the "testing and safety gates" commitment from day one), a `users` table that exists and is ready for Sprint 6, and a `.env.example` that makes the project's real configuration surface visible for the first time.
- **Fully and trivially reversible:** both sprints' rollback plans are "drop the new thing" — there is no scenario where this first package leaves the codebase in a worse state than before it started.
- **Establishes the non-regression discipline early:** Sprint 1's acceptance criteria is literally "prove nothing changed" — this sets the pattern the riskier later sprints (5, 7, 8) depend on: a green baseline run before, an identical green run after.

**What to explicitly defer past this first package:** anything touching `settings` (Sprint 5), any route's query logic (Sprint 7), and definitely the automation scheduler (Sprint 8) — none of these should be attempted until Sprints 1–4's foundation is proven stable in whatever environment you consider "real" (staging or production), not just passing tests locally.

---

## 11. OWNER DECISIONS REQUIRED BEFORE CODING

1. **Authentication provider (§3).** Recommendation given: **Better-Auth**, self-hosted. Alternative to weigh: **Clerk**, if speed-to-first-user outweighs long-term platform independence. This decision blocks Sprint 6 and everything downstream of it.

2. **Automation scheduler multi-tenancy model (§4.4).** This is the single highest-consequence decision in the whole phase, because it's the one place where "add `user_id`" isn't mechanical — it changes how the kill switch and guardrails operate at a structural level (one global cycle today; must become per-user). Needs explicit sign-off on the target design *before* Sprint 8 is scoped in detail, not just before it's coded.

3. **`stock_analysis_history` — per-user or shared cache (§2.1).** Default recommendation is per-user (simplest, safest, consistent with every other table). Flagging because a shared-cache-by-symbol model is a legitimate alternative if research compute cost becomes a concern later — worth a deliberate "no, not now" rather than defaulting silently.

4. **Legacy data ownership (§2.5, step 2).** Confirm which email/identity should own the existing single-tenant data as "user #1" during backfill — this is a one-line decision but needs to come from you, not be assumed.

5. **`user_id` column type precedent (§2.2).** Proposing `uuid` for `users.id` (and therefore every FK), which is a deliberate departure from every existing table's `serial` primary key convention. Flagging as a decision rather than a silent inconsistency — the alternative (serial, sequential user IDs) is simpler but makes user IDs guessable/enumerable, which matters more for a `users` table than for internal tables like `trades`.

6. **CORS policy (§4.5).** Current `cors()` call allows any origin. Needs a decision on the allowed origin list (production frontend domain, any staging domains, local dev) before Sprint 6/7 ship — this is a small fix but has a concrete list of values only you can supply.

7. **Deprecation window length for the legacy `OPENAI_API_KEY` overload (§7.3, §9 Sprint 2).** Proposing "keep it working, log a warning" indefinitely until a later, explicitly-scoped cleanup phase — confirm you're comfortable with the legacy path staying live rather than being force-removed in Phase 1.

---

*This plan modifies no code. Every file path, table name, and code behavior described above was verified by direct inspection of the uploaded source on July 12, 2026. Where a fact could not be directly verified (e.g., `BASE_PATH`'s exact consuming file), it is explicitly flagged rather than assumed.*
