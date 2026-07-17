# Phase 9 — Technical Debt Report

Companion to `docs/Phase-9-Production-Readiness-Report.md`. Every item below was found during the Phase 9 audit and deliberately **not** fixed this phase — each has a stated reason, matching this project's own "disclose, don't silently fix or silently skip" discipline.

---

## 1. Deliberately deferred — deployment/product decisions, not code defects

| Item | Why it's not "just a bug" | Recommendation |
|---|---|---|
| `REQUIRE_AUTH` defaults to unset (off) | This is an intentional, documented rollback-safe default (every route falls back to a legacy-owner stand-in via `getScopedUserId()`) — flipping it is a deployment decision about whether this instance is genuinely multi-tenant, not a code fix | Set `REQUIRE_AUTH=true` before any real multi-user deployment; verify sign-in end-to-end first |
| No Content-Security-Policy header | A CSP needs a real inventory of every legitimate script/style/connect origin the frontend actually talks to. Guessing one either breaks the app (too strict) or does nothing (too loose, `unsafe-inline` everywhere) | A dedicated future task: enumerate real origins, then add a real, tested CSP |
| Production `CORS_ALLOWED_ORIGINS` value | The mechanism (env-var-driven allow-list, unset = open) already exists from an earlier sprint. The actual origin value is a deployment-time fact only the deploying party knows | Set before deploying behind a real frontend origin |
| Live external data (`FMP_API_KEY`/`ALPHA_VANTAGE_API_KEY`/`ALPACA_API_KEY`) | No credential was available in this session at any point | Provide credentials, then run a dedicated live-verification pass — no new code should be needed, only verification |

---

## 2. Deliberately deferred — real findings, judged too risky to fix in a hardening pass

| Item | Location | Why deferred |
|---|---|---|
| `alpacaApiKey` is echoed in plaintext by `GET`/`PATCH /settings` | `routes/settings.ts` | Fixing this touches the settings API contract, which `Settings.tsx`'s own edit form depends on for its current "show the key, let the user edit it" UX. A safe fix (mask-on-read, write-only-on-change) needs its own small design pass, not a rushed change during a broad hardening sprint |
| `auto_execution_log` has no indexes beyond its primary key | `lib/db/src/schema/autoExecutionLog.ts` (implied) | This table is explicitly protected — CLAUDE.md rule 3: "Never touch `autoExecutionLog`... as part of general audit-log work." Left untouched on purpose, even though an index would likely help query performance as the log grows |
| `lib/tradingProbability.ts`'s own `erf()`/`normCdf()` duplicates `optionsMath.ts`'s exported `normCdf()` | `lib/tradingProbability.ts` | A pure-refactor merge is tempting, but `optionsMath.ts` is a CLAUDE.md rule-1 protected file — even a behavior-preserving import change there requires explicit, specific approval before touching it, which this phase did not seek |
| `getAccountValue()` sums over **all** closed trades for a user with no `LIMIT` | `lib/serverState.ts` | Adding `.limit()` here would silently corrupt the computed dollar total — this is a correctness constraint, not a performance bug. The real fix is exactly what Phase 9 already did: index `trades(user_id, status)` so the full scan is at least index-covered, not a sequential scan. No further change needed unless real-world trade volume per user grows into the tens of thousands |
| `GET /journal`, `GET /notifications`, `tradeJournal.ts`'s `closedTrades()`/`linkedJournalEntriesFor()` are unbounded (no pagination) | multiple route files | Adding a default `LIMIT`/pagination would be a real behavior change to what a client currently sees (an existing UI expecting "all rows" would silently start showing a partial list) — deferred rather than risking a silent regression. A future sprint should add real pagination as an explicit, disclosed API change, with the frontend updated in lockstep |
| `ravish-trading-engine.zip` at the repo root (a historical backup archive, ~860KB) | repo root | Following this project's own established precedent (flag, don't delete unilaterally) — not touched this phase, not investigated fresh either since it's outside Phase 9's stated scope |
| `attached_assets/` (9 historical `.txt` files, reachable via the `@assets` alias but not imported anywhere found during this audit) | repo root | Same "flag, don't delete unilaterally" precedent |

---

## 3. Accessibility debt (see the Production Readiness Report §5 for the full list)

- Color-only signal in `PortfolioConstruction.tsx`'s rebalance badges.
- Several mouse-only `onClick` handlers on non-interactive elements (`div`/`CardHeader`) that weren't addressed this phase, unlike `Adjustments.tsx`'s row which was.
- `Assistant.tsx`'s suggestion chips are styled buttons, not real `<button>` elements.
- No automated `axe-core`/Lighthouse pass was run — everything found this phase came from manual code reading.

---

## 4. Test debt

- `src/lib/tradeAdjustmentPreview.test.ts`'s "Roll Forward scenario" is a **known, reproducible, pre-existing failure** (6 tests) tied to a date-seeded deterministic pricing scenario no longer producing a roll-eligible position under today's date — see the Production Readiness Report §6 for the full evidence trail proving this predates Phase 9. Recommended fix (future sprint, not this one): make the test's own fixture construction robust to date drift (e.g. explicitly perturb the position to guarantee eligibility, rather than relying on an untouched snapshot happening to qualify), without touching the protected adjustment-engine logic itself.
- No dedicated backend test exists for `lib/db/src/client.ts`'s new pool-configuration values (`envInt()` and its defaults) — the change is small and low-risk (a pure `pg.Pool` constructor-options change with library-default fallbacks), but a unit test for `envInt()`'s parsing/fallback behavior would be a cheap, real addition for a future sprint.

---

## 5. Bundle size trend (see the Performance Report for full detail)

The largest frontend chunk is now 480.43 kB (up from an earlier-recorded 461.57 kB baseline in the other development thread's own history), still under Vite's 500 kB warning threshold but closing in on it. This is a **trend to watch**, not an immediate defect — no single Phase 9 change caused this (Phase 9 net-removed 27 files); the growth reflects cumulative feature work across this session's own Phase 1–8. A future sprint should consider whether any of the largest remaining lazy chunks (the shared `index` chunk itself, `generateCategoricalChart` for recharts, `markdown` rendering) can be split further or deferred.
