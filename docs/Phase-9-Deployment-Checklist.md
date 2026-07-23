# Phase 9 — Deployment Checklist

Companion to `docs/Phase-9-Production-Readiness-Report.md`. A concrete, step-by-step checklist for deploying this build. See also the other development thread's own `docs/Production-Rollout-Plan.md` and `docs/Operations-Handbook.md`, which remain accurate and cover the same underlying platform in more operational depth — this checklist is the Phase-9-specific subset relevant to what changed this phase.

---

## 1. Before deploying

- [ ] Run `pnpm run typecheck` — must be clean across the whole workspace.
- [ ] Run `pnpm --filter @workspace/api-server run test` **twice** — expect 160/161 files, 1869/1875 tests passing both times, with the single known-and-documented `tradeAdjustmentPreview.test.ts` "Roll Forward scenario" failure (see the Production Readiness Report §6). If any **other** test fails, stop and investigate — that is a real regression, not the known issue.
- [ ] Run `pnpm --filter @workspace/ravish-trading run test` — expect all files passing (596 tests as of this phase).
- [ ] Run `PORT=5000 BASE_PATH=/ pnpm run build` — must succeed with no chunk-size warning.
- [ ] Confirm `git diff --stat` against `execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, `autoAdjustment.ts` shows **zero output** — these must never be touched by a hardening phase without explicit, separate approval.

## 2. Database migration

- [ ] Apply `lib/db/manual-migrations/020_production_readiness_indexes.sql` (idempotent — uses `CREATE INDEX IF NOT EXISTS`, safe to run against a database that already has some or none of the 3 new indexes).
- [ ] Confirm the 3 new indexes exist:
  ```sql
  select indexname, tablename from pg_indexes
  where indexname in (
    'journal_entries_trade_id_idx',
    'scanner_results_user_id_status_idx',
    'trades_user_id_status_idx'
  );
  -- expect exactly 3 rows
  ```
- [ ] No data migration, backfill, or `NOT NULL` enforcement is involved — this migration is purely additive (new indexes only). No table lock beyond what `CREATE INDEX` itself briefly takes.

## 3. Environment variables — new/changed this phase

All of the following are **optional** — every one has a safe, documented default and nothing in this phase requires a new environment variable to be set before deploying.

| Variable | Default | Purpose |
|---|---|---|
| `DB_POOL_MAX` | 10 | Max Postgres connections in the pool |
| `DB_POOL_IDLE_TIMEOUT_MS` | 30000 | How long an idle pooled connection is kept before being closed |
| `DB_POOL_CONNECTION_TIMEOUT_MS` | 10000 | How long to wait for a connection to become available before failing |
| `DB_STATEMENT_TIMEOUT_MS` | 30000 | Server-side statement timeout — a query running longer than this is aborted |
| `FORCE_HSTS` | unset (false) | Set to `"true"` only if this server is genuinely reached over TLS but Express itself can't detect it (e.g. TLS terminated at a load balancer that doesn't set a trusted `X-Forwarded-Proto`) |

No existing environment variable's meaning or default changed this phase.

## 4. Post-deployment verification

- [ ] `curl -i https://<your-domain>/api/healthz` — confirm `200` and the presence of `x-content-type-options: nosniff` and `x-frame-options: DENY` response headers (proves the new security-headers middleware is live).
- [ ] Deliberately trigger a 500 (e.g. hit a route with malformed input the route itself doesn't already validate) and confirm the response body is the generic `{"error": "Internal server error"}` — never a stack trace.
- [ ] Confirm the frontend loads and a deliberately-broken page state (if testable) shows the new error-boundary fallback rather than a blank white screen.
- [ ] Watch server logs for the first few minutes after deploy for any `uncaughtException`/`unhandledRejection` log line — none expected under normal operation.

## 5. Rollback

Every change this phase is either purely additive (new indexes, new middleware, new files) or a narrow, isolated edit to an existing file (pool config, `ensureSeedTrades()` batching, React Query defaults, dead-file deletion). Rolling back is a standard git revert of this phase's commit(s) plus, if desired, dropping the 3 new indexes (`DROP INDEX IF EXISTS journal_entries_trade_id_idx; DROP INDEX IF EXISTS scanner_results_user_id_status_idx; DROP INDEX IF EXISTS trades_user_id_status_idx;` — safe, no data loss, only returns query planning to its pre-Phase-9 behavior).
