# Broker Reconciliation

**Phase 11 — Live Market Operations & Production Validation.** This document covers "add reconciliation reports" and "detect drift between broker and local state" — the persisted-history extension this phase built on top of the already-existing, unmodified `GET /broker/reconciliation` live comparison.

**Not duplicated, only extended:** `lib/brokerReconciliation.ts`'s own `buildReconciliation()` (position/order drift detection between local `trades` rows and Alpaca's own orders/positions) is untouched by this phase — confirmed via `git diff`. This document covers only the new persistence layer around it. For the comparison logic itself (issue types, the trackable-order-id/uniform-ratio-leg scope limits, the symbol-comparison caveat), see `docs/Alpaca-Paper-Trading-Architecture.md` §4 and `docs/Broker-Health-API.md`.

---

## 1. What was missing before this phase

`GET /broker/reconciliation` computed a live comparison on every call and returned it — nothing was ever persisted. There was no way to see whether reconciliation issues from an hour ago, a day ago, or last week had been resolved, worsened, or recurred; every call was a fresh snapshot with no memory of the last one.

## 2. What this phase added

A new table, `broker_reconciliation_reports` (`lib/db/manual-migrations/022_broker_reconciliation_reports.sql`), and three routes on the existing `routes/brokerReconciliation.ts`:

| Route | Purpose |
|---|---|
| `POST /broker/reconciliation/reports` | Runs a fresh `buildReconciliation()` and persists a snapshot — **explicit-trigger only**, never on a schedule. Returns the summary. |
| `GET /broker/reconciliation/reports` | Lists the calling user's own persisted report summaries, newest first (bounded to 20). |
| `GET /broker/reconciliation/reports/:id` | Full detail for one persisted report (the entire `ReconciliationResult`, including every order/position entry), ownership-scoped — 404 for both "doesn't exist" and "isn't yours." |

Each persisted row carries the full `ReconciliationResult` as a `jsonb` blob (`detail_json`) plus promoted headline columns (`issue_count`, `fully_reconciled`, `local_orders_considered`, `broker_orders_considered`, `available`) so a list view never needs to deserialize the blob for every row — the same jsonb-blob-plus-headline-columns pattern `stock_analysis_history`/`trading_backtest_results` already established elsewhere in this codebase.

**Explicit-trigger-only, deliberately** — matching this platform's own established never-auto-persist-without-a-user-action discipline (the Watchlist "Check Targets" button, the Options/Trading Backtest "Run" buttons). A plain `GET /broker/reconciliation` (the pre-existing live-only route) still never writes a row; only a real `POST /broker/reconciliation/reports` does.

## 3. Access

Surfaced on the new Operations Dashboard (`docs/Live-Market-Validation.md` §6, `docs/Operations-Runbook.md`) as "Recent Syncs," with a "Run Reconciliation Now" button. It is **not** admin-gated — every user can reconcile and view their own history, the same ownership model every other per-user route in this codebase uses; the Operations Dashboard simply happens to also surface it there for convenience since it's operationally relevant.

## 4. What this does — and does not — cover

Covered (unchanged from the pre-existing live comparison):

- Order drift: missing at broker, missing locally, status/quantity/symbol mismatches.
- Position drift: local vs. broker quantity mismatches for open positions.

**Not covered, disclosed as a genuine gap, not silently omitted:** portfolio-level figures (total portfolio value, buying power, cash balance) are **not** reconciled or tracked over time by this system — those are read live, on demand, via `GET /broker/health`'s own `portfolioValue`/`buyingPower`/`cashBalance` fields (Phase 6), which have no persisted history of their own either. A drift-over-time view for those aggregate figures (e.g., "portfolio value has diverged from the sum of locally-tracked positions by $X over the last week") does not exist and would be new functionality, not an extension of this phase's own scope — noted as a candidate for a future phase.

## 5. Testing

`routes/brokerReconciliation.route.test.ts` gained a new `describe("Reconciliation reports")` block (5 live end-to-end tests against the real app + real Postgres): persist-then-list, persist-then-get-full-detail, 404 for a nonexistent id, 400 for a non-numeric id. Every row this test file creates is deleted in its own `afterAll`, leaving no residue in the shared legacy-owner account other sibling test files also use. `lib/tenantIsolation.test.ts` gained one new case proving `broker_reconciliation_reports` is correctly userId-scoped.

## Cross-references

- `docs/Alpaca-Paper-Trading-Architecture.md` §4 — the underlying reconciliation comparison logic (unmodified).
- `docs/Broker-Health-API.md` — the account-verification endpoint this reconciliation system's credentials resolution shares.
- `docs/Live-Market-Validation.md` — the market-data-side validation work from this same phase.
- `docs/Operations-Runbook.md` — the Operations Dashboard where this is surfaced.
