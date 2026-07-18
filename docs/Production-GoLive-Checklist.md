# Production Go-Live Checklist

**Phase 11 — Live Market Operations & Production Validation.** This is the single, current, one-page go/no-go checklist reflecting every phase's work through this one. It does **not** replace `docs/Production-Rollout-Plan.md` (the detailed "how" — deployment steps, staged rollout order, backup/recovery, rollback procedures) or `docs/Production-Readiness-Report.md` (the original "are we ready" assessment, produced at Phase 6 Sprint 77) — both remain authoritative for their own depth of detail. This document is the checklist an operator actually runs through immediately before flipping the switch, incorporating everything this phase found and built.

**Status: no go-live has been authorized by this document.** Like its predecessors, this is a planning and documentation artifact — it authorizes nothing on its own.

---

## 1. Pre-flight

- [ ] `pnpm run typecheck`, both backend test suites (run twice), frontend test suite, and `PORT=5000 BASE_PATH=/ pnpm run build` all pass — confirmed this phase (§4 below).
- [ ] `git diff --stat` on `execution.ts`/`optionsMath.ts`/`risk.ts`/`autoExecution.ts`/`autoAdjustment.ts` shows zero lines — confirmed this phase, extending the unbroken zero-diff streak since Sprint 32.
- [ ] Environment variables validated against `.env.example` and `docs/Production-Rollout-Plan.md` §3 — no new variables were introduced this phase.
- [ ] `BETTER_AUTH_SECRET` is set to a real, unique, non-default value (the process refuses to start otherwise — confirmed live during this phase's own test runs).
- [ ] `CORS_ALLOWED_ORIGINS` — decided deliberately for the target deployment's origin topology (still the standing, unresolved gap first flagged at Phase 1 Sprint 6; the mechanism is finalized, only the actual production origin value is a deployment-time decision).
- [ ] `REQUIRE_AUTH` — decided deliberately (see `docs/Production-Rollout-Plan.md` §3).

## 2. Live credentials (blocking for any live-data stage)

- [ ] `FMP_API_KEY` and/or `ALPHA_VANTAGE_API_KEY` — **not present in this session**, confirmed by direct inspection before this phase and every prior credential-gated sprint since Sprint 11. Required only for Engine 1's live fundamentals stage; the SIMULATED path is fully production-ready without them.
- [ ] `ALPACA_API_KEY`/`ALPACA_API_SECRET` — **not present in this session.** Required for the Broker Health/Reconciliation/Market Calendar live paths this phase built and tested against mocked fetch only. Blocking for any stage that needs a real broker connection.
- [ ] `POLYGON_API_KEY` — present in `.env.example` but wired to nothing (`polygonProvider.ts` is a genuine, honest placeholder — `isAvailable()` always `false`). Not blocking; simply unimplemented.

## 3. New this phase — Live Market Operations & Production Validation

- [ ] **Administrator account provisioned.** At least one real user promoted to `role = 'admin'` via the manual SQL statement in `docs/Operations-Runbook.md` §2, so the Operations Dashboard is actually usable post-launch. There is no default admin account and no self-service promotion — this step is easy to forget.
- [ ] **Operations Dashboard reachable and correctly gated** (`/operations`) — verify a non-admin session sees the honest "Administrators only" message and a real admin session sees the full dashboard, both client-side and via a direct `curl` against `GET /api/ops/market-data-validation` (should 401/403/200 as appropriate — see `routes/ops.route.test.ts`).
- [ ] **At least one reconciliation report has been run** (`POST /broker/reconciliation/reports`, or the Operations Dashboard's "Run Reconciliation Now" button) post-launch, to confirm the whole pipeline works against the real target database.
- [ ] **Market Calendar behavior reviewed** for the specific go-live date — if launching near a known market holiday or half-day, confirm whether the static approximation (`docs/Live-Market-Validation.md` §2) or the live Alpaca calendar will be the effective source, given whether Alpaca credentials are configured yet.

## 4. Validation run for this phase (recorded here for the go-live record)

- `pnpm run typecheck` — clean.
- `pnpm --filter @workspace/api-server run test` — run multiple times; only pre-existing, previously-disclosed flakes (the `fetchedAt`-timing race, shared-legacy-owner-account parallelism races) reproduced, none in any file this phase touched.
- `pnpm --filter @workspace/ravish-trading run test` — clean.
- `PORT=5000 BASE_PATH=/ pnpm run build` — clean, no bundle-size warning.
- Full counts and commit hashes are in this phase's own completion report.

## 5. Rollback

No new rollback procedure is needed beyond `docs/Production-Rollout-Plan.md` §6 — this phase introduced two purely-additive tables (`broker_reconciliation_reports`; `dashboard_workspaces` was Phase 10's) and zero schema changes to any existing table. Rolling back this phase's code (reverting the commits) leaves both new tables present but simply unused — no data-loss risk, no migration-rollback step required. The one operational rollback specific to this phase: if `requireAdmin` gating causes an unexpected issue in production, the fix is to review/adjust which accounts hold the `admin` role (§2 of `docs/Operations-Runbook.md`), never to remove the gate itself without the same explicit-approval process every other change requires.

## 6. Production readiness assessment

| Area | Status |
|---|---|
| SIMULATED-mode functionality (all 3 engines) | Ready |
| Live market data (FMP/Alpha Vantage/Alpaca/Polygon) | Blocked — no credentials in this session |
| Broker connectivity (Alpaca Paper Trading) | Blocked — no credentials in this session |
| Market calendar/clock | Ready (static approximation) for any deployment without Alpaca credentials; upgrades automatically to live once configured |
| Operations Dashboard / admin gating | Ready — tested end-to-end against a real Postgres-backed Better-Auth instance |
| Reconciliation reports | Ready |
| Background job / scheduler observability | Ready (Phase 6, re-confirmed this phase) |
| Security posture | Reviewed this phase (`docs/Operations-Runbook.md` §4) — no urgent findings, several disclosed accepted risks for the current deployment scale |
| Multi-instance horizontal scaling | **Not ready** — several in-memory caches (job health, request metrics, rate limiting, broker-health cache) are single-instance only, disclosed this phase for the first time in one place |

## Cross-references

- `docs/Production-Rollout-Plan.md` — the detailed deployment/rollback/backup procedures.
- `docs/Production-Readiness-Report.md` — the original Phase 6 readiness assessment.
- `docs/Operations-Runbook.md` — background job audit, admin promotion, security review.
- `docs/Live-Market-Validation.md`, `docs/Broker-Reconciliation.md` — this phase's own two other new documents.
