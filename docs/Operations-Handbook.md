# Operations Handbook

**Status: living operational document**, introduced in Phase 6, Sprint 77 (see `docs/Phase-6-Master-Planning-Document.md` §2h). This is the day-to-day reference for **operating** the platform once deployed — distinct in purpose from `docs/Production-Rollout-Plan.md` (the one-time go-live procedure) and `docs/Incident-Response-Runbook.md` (Sprint 74, the per-alert-category diagnosis/recovery reference this handbook cross-references rather than duplicates).

Update this document whenever an operational procedure changes — it should describe how the platform is actually operated, not how it was originally designed to be.

---

## 1. Who This Document Is For

Whoever holds day-to-day operational responsibility for a running deployment of this platform — checking its health, responding to routine questions from users, performing routine maintenance, and being the first line of response before an issue escalates to the deeper diagnosis in `docs/Incident-Response-Runbook.md`.

---

## 2. Daily Operations

- [ ] Check `GET /api/monitoring/status` — confirm `status: "ok"` and `alerts: []`. If `status: "degraded"`, consult `docs/Incident-Response-Runbook.md` §2 for the specific alert category shown.
- [ ] Skim the previous 24 hours of `pino` logs (or whatever log-aggregation tool the hosting platform provides) for any `error`-level line not already surfaced as a monitoring alert.
- [ ] If the Options Income Engine's automation is live for any user (Stage 1 of the rollout plan), spot-check `GET /execution/auto/status` for that account and confirm the reported state (`armed`, `executionMode`) matches what's expected.

## 3. Weekly Operations

- [ ] Review the request-volume snapshot log lines (Sprint 52, every 5 minutes) for the week's own traffic trend — is total volume growing in a way that suggests revisiting the rate-limit thresholds (`docs/Production-Rollout-Plan.md` §3.2)?
- [ ] Review `platform_audit_log` for the week's `auth.login_failed` and `settings.updated` rows — a routine sanity check, not a forensic audit, looking only for anything that looks obviously wrong (a burst of failures from one account, a settings change nobody remembers making).
- [ ] Confirm the most recent scheduled database backup (`docs/Production-Rollout-Plan.md` §4.1) completed successfully.
- [ ] If any live-data provider is active (Stage 1/2 of the rollout), spot-check that its own `*Connected` settings field still reads `true` and that a fresh report/scan genuinely carries live (not silently-fallen-back-to-SIMULATED) data in its `dataSource` field.

## 4. Monthly Operations

- [ ] Review the accumulated month of `GET /api/monitoring/status` alert history (via `platform_audit_log`'s `eventType = "monitoring.alert"` rows) — look for any alert category that fires repeatedly; a recurring `warning`-severity alert that never escalates to `critical` may still indicate a threshold that needs retuning (`docs/Production-Rollout-Plan.md` §10, risk #7).
- [ ] Reconcile the manual migration file count in `lib/db/manual-migrations/` against what's actually applied to the production database — confirm no migration was ever skipped.
- [ ] Rotate any credential nearing its own provider's recommended rotation window (§5 below).
- [ ] Re-read `docs/Incident-Response-Runbook.md` in full — confirm nothing about the described architecture has silently drifted from reality; update it if it has.

---

## 5. Credential Rotation

**General procedure, applicable to any of the credentials in `.env.example`:**

1. Generate the new credential value with the issuing provider (Anthropic, Alpaca, FMP, Alpha Vantage, or regenerate `BETTER_AUTH_SECRET` via `openssl rand -base64 32`).
2. Update the environment variable in the hosting platform's own secret-management interface — **never** commit the real value anywhere, per `CLAUDE.md` rule 8.
3. Restart the application process so the new value takes effect (this codebase reads all credentials from `process.env` at call time or at `init()`, never caches a stale value across a restart).
4. Confirm the affected functionality still works (e.g., after rotating `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`, confirm `POST /coach/teach-greek` or any AI-narration endpoint still returns a real, non-fallback response).
5. Revoke the old credential with the issuing provider once the new one is confirmed working.

**`BETTER_AUTH_SECRET` specifically:** rotating this invalidates every existing user session (Better-Auth signs session tokens with it) — every signed-in user will need to sign in again. Communicate this to users before rotating in a live multi-tenant deployment, or schedule it for a low-traffic window.

**Broker/live-data credentials specifically (once any rollout stage is live):** rotating `ALPACA_API_KEY`/`ALPACA_API_SECRET` while the automation scheduler is armed for that account risks a mid-cycle authentication failure — per `docs/Incident-Response-Runbook.md`'s own established pattern, this surfaces honestly as a `scheduler.repeated_failure` alert (the engine fails closed, never silently), but the cleaner procedure is to **disarm the kill switch first** (§6 below), rotate, confirm connectivity via a read-only call, then re-arm.

---

## 6. Common Operational Tasks

### 6.1 Arming / disarming the automation kill switch

- **Disarm (the fast, safe default action for any concern):** `PATCH /api/settings` with `{"autoExecuteEnabled": false}` (and `{"autoAdjustEnabled": false}` if the adjustment engine specifically is the concern), or via the AutoPilot/Adjustments pages' own master switches. Takes effect on the very next scheduler tick (within 60 seconds) — no restart needed.
- **Arm:** the reverse — set the field(s) back to `true`, and confirm `executionMode` is set to `full_auto` (both are required together; see `.agents/memory/auto-execution-engine.md` for the full precedence rules). Only arm an account after confirming its guardrail settings (`autoMaxTradesPerDay`, `autoMaxConcurrentPositions`, `autoMinRavishScore`, `autoMaxDailyLossPct`) are genuinely what that user intends — never arm with default/placeholder guardrail values for a real account.

### 6.2 Running a manual scheduler cycle

`POST /execution/auto/run` (opening) or `POST /execution/auto/adjust/run` (de-risking) trigger one cycle immediately for the calling user, outside the normal 60-second tick — useful for confirming a guardrail change takes effect without waiting for the next natural tick. Per Sprint 67's own security review, these are **not** a kill-switch bypass — they call the identical gated cycle function the scheduler itself uses.

### 6.3 Checking why a specific decision was made

`GET /execution/auto/log` (and its `/adjust/log` counterpart) return the full, filterable decision history from `auto_execution_log` — every `executed`/`skipped`/`rejected`/`blocked` decision carries its own `reason` text. This is the first place to look for "why didn't my trade execute" or "why was this position closed" questions, before escalating to a code-level investigation.

### 6.4 Checking a user's own settings/audit history

`GET /api/settings` for current state; `platform_audit_log` (filtered by `userId`) for the history of changes to it, including who/when/which fields changed (never the values themselves, per the established privacy-preserving `changedFields`-only logging convention).

### 6.5 Verifying the Alpaca Paper Trading broker connection

`GET /api/broker/health` performs a live, read-only, authenticated round trip
to Alpaca's Paper Trading API (`GET /v2/account`, `/v2/positions`,
`/v2/orders`) and reports connection status, account balances, and open
position/order counts — never places, modifies, or cancels an order. It does
not run automatically; call it explicitly to check or refresh the connection
status. `GET /api/settings`'s `alpacaConnected` field reflects the outcome of
the most recently-performed check (a passive cache read, not a live call
triggered by `/settings` itself) — it stays honestly `false` until
`/api/broker/health` has been called at least once in the running process.

**Via the UI:** Settings → Broker Connection → **Check Connection**. The
button is disabled while the check is in flight and re-enables once it
completes. On success it shows account status, buying power, cash balance,
portfolio value, open position/order counts, and the last successful check
time; on failure it shows the exact reason, plus — specifically when
credentials are missing — a friendly note naming the required
`ALPACA_API_KEY`/`ALPACA_API_SECRET` environment variables. The connection
indicator at the top of the card updates immediately from the response,
before any settings reload. A permanent "Paper Trading Only" badge on the
card is a standing reminder that this connection never targets a live
endpoint.

Full detail: `docs/Broker-Health-API.md` (§10 covers the UI specifically).

### 6.6 Reconciling local trades against Alpaca Paper Trading orders/positions

`GET /api/broker/reconciliation` compares this platform's own local trade
records against Alpaca's real Paper Trading orders and positions and
reports discrepancies — missing at broker, missing locally, status/quantity/
symbol mismatches, open-position mismatches. **Entirely read-only**: it
never corrects, cancels, or closes anything on either side, and it only
runs when explicitly requested (page load or a manual Refresh button) —
never on a schedule.

**Via the UI:** the "Broker Reconciliation" nav item (`/broker-reconciliation`).
Shows a summary (Fully Reconciled or an issue count), an order-reconciliation
table (local vs. broker status/quantity/fill side by side), and a
position-comparison table — plus a Refresh button, disabled while a check is
in flight. When credentials are missing, the page stays fully usable and
shows the honest reason rather than a blank or fabricated result. There is
no distinct admin role in this platform (§6.7 below) — this page is
reachable by any signed-in user, scoped to their own account's own trades.

Two related read-only endpoints exist alongside it: `GET /api/broker/orders`
(every order, any status) and `GET /api/broker/orders/:orderId` (a single
order by id) — useful for direct inspection outside the reconciliation
comparison itself.

Full detail, including the normalized order-lifecycle model and every
reconciliation rule: `docs/Alpaca-Paper-Trading-Architecture.md`.

### 6.7 Adding a new operator/admin user

This platform's `role` field on `users` exists but — confirmed by direct inspection — has no differentiated admin-only functionality built on top of it as of Sprint 77; every route's own authorization is per-user data scoping (`getScopedUserId()`), not role-based. There is currently no "operator dashboard" distinct from a regular user's own account. Standing up one is out of scope for this handbook and would be its own future sprint if ever needed.

### 6.8 Checking the Paper Portfolio Dashboard

The "Paper Portfolio" nav item (`/paper-portfolio`) composes Broker Health,
positions, and Reconciliation into one at-a-glance view: account status,
buying power, cash balance, portfolio value, open position/order counts,
Unrealized P/L (summed live from real positions once checked), Realized P/L
(always honestly "Not available" — no endpoint exists for it, see
`docs/Alpaca-Paper-Trading-Architecture.md` §4.6), and one card per open
position (symbol, quantity, average cost, long/short, and a reconciliation
badge).

**Every section requires its own explicit Refresh** — Refresh Broker
Health, Refresh Portfolio, Refresh Reconciliation. None of the three fetch
automatically on page load; this page is stricter about "manual only" than
the Broker Reconciliation page (§6.6), which does fetch once on load. Each
button disables itself, independently, only while its own request is in
flight. When credentials are missing or a check fails, each section shows
its own honest reason and the rest of the page stays fully usable.

Full detail: `docs/Alpaca-Paper-Trading-Architecture.md` §4.6.

### 6.9 Trade History, Trade Performance, and the Trading Journal

Three related nav items, all built on **local trade data only** unless a
manual broker reconciliation check has been run:

- **"Trade History"** (`/trade-history`) — a sortable, filterable,
  searchable, paginated table of every local trade (date/time, symbol,
  strategy, derived Long/Short direction, quantity, entry price, a derived
  exit price when the trade is closed, status, holding period, local trade
  id, and broker order id when one exists). Expanding a row opens a detail
  panel with the full journal entry for that trade (editable in place —
  Notes, Thesis, Entry Reasoning, Lessons Learned, plus the trade's own
  existing Exit Reason), a static AI-review placeholder (no LLM call yet),
  and a broker cross-reference summary (local status, broker status,
  mismatches, fill quantity, average fill price) sourced from the same
  reconciliation endpoint as §6.6, checked only via an explicit "Check
  Reconciliation" button — never automatically.
- **"Trade Performance"** (`/trade-performance`) — dashboard cards (total/
  winning/losing trades, win rate, average win/loss, average holding time,
  largest winner/loser, open/closed trade counts) computed entirely from
  local trade history, plus a separately-labeled Reconciliation Success
  percentage that is the one card genuinely dependent on a manual broker
  check. Named "Trade Performance," not "Performance," to avoid colliding
  with the pre-existing, unrelated Options Income Engine performance page
  at `/performance`.
- **Trading Journal** — no new page; journal entries continue to be
  createable and editable from the pre-existing `/journal` page exactly as
  before, and are now also editable per-trade from the Trade History detail
  panel above. Two new optional fields, Thesis and Entry Reasoning, were
  added to journal entries this sprint.

**Every figure on these two pages is either derived from real, already-
stored local data or explicitly labeled as unavailable/not-yet-checked —
none is a fabricated or invented broker value.** Direction and exit price
are honest derivations from stored fields (documented in
`docs/Alpaca-Paper-Trading-Architecture.md` §4.7), not literal broker fill
data.

Full detail: `docs/Alpaca-Paper-Trading-Architecture.md` §4.7 and
`docs/Trading-Journal.md`.

### 6.10 Using the Order Preview & Risk Simulator

The "Order Preview" nav item (`/order-preview`) lets a user type in a
symbol, strategy, and quantity and see the full estimated economics of an
order — estimated entry price, notional value, buying power impact, margin
impact, maximum risk, maximum reward, and risk/reward ratio — plus an
8-item pre-trade checklist (missing fields, invalid quantity, invalid
symbol, buying power unavailable, broker disconnected, missing
credentials, position conflict, existing open order). **There is no submit
button on this page — it is a dry-run only, and no order can be placed
from it.**

Every number shown is either reused, unmodified, from `execution.ts`'s own
real ticket-building logic (the same numbers a genuine order preview/
submit would compute), or a small, disclosed derivation on top of them
(entry price per spread, notional value, margin impact, risk/reward
ratio) — never a fabricated figure. Broker connection status on this page
is read via the same manual-only "Refresh Broker Health" button every
other broker-touching page in this app uses (§6.5) — it never auto-checks
on page load.

Full detail: `docs/Alpaca-Paper-Trading-Architecture.md` §4.8 and
`docs/Order-Preview.md`.

### 6.11 Using the Position Sizing & Portfolio Impact Calculator

The "Position Sizing" nav item (`/position-sizing`) extends the Order
Preview above with a full pre-trade sizing and portfolio-impact
experience: recommended position size, position size as % of portfolio,
buying power utilization, capital at risk, maximum theoretical loss/gain,
break-even price(s), risk/reward ratio, and portfolio concentration
before/after the trade — plus a side-by-side **Current Portfolio** vs.
**Hypothetical Post-Preview Portfolio** comparison (exposure by symbol,
long/short exposure, estimated delta/theta/gamma/vega impact), an 8-item
risk-warnings list, and a 50%/75%/100%/custom quantity scenario
comparison table. **There is no submit button on this page — it is a
dry-run only, and no order can be placed from it.**

All calculations reuse this platform's existing execution and options
logic (`execution.ts`'s `previewOptionOrder()`, via last sprint's Order
Preview endpoint, and `serverState.ts`'s `computeTradeGreeks()`) — no
execution logic was modified, no broker writes occur, and no orders are
submitted. **Portfolio impact is hypothetical only**: the "Hypothetical
Post-Preview Portfolio" section is always clearly labeled as a simulation
and is never confused with real, already-open positions. The "Current
Portfolio" section reads this user's own real open trades but
deliberately does not auto-seed demo trades into an empty account — an
account with no open positions is shown as genuinely empty.

Full detail: `docs/Alpaca-Paper-Trading-Architecture.md` §4.9 and
`docs/Position-Sizing.md`.

### 6.12 Using the Trade Adjustment & Roll/Convert Preview Simulator

The "Adjustment Preview" nav item (`/adjustment-preview`) lets a user
pick an existing open position and preview one of 8 adjustment intents
(Roll Forward, Roll Out, Roll Up, Roll Down, Roll Out & Up, Roll Out &
Down, Convert Position, Close & Replace). **Only 3 are genuinely
computable** by this platform's existing adjustment engine — Roll
Forward and Convert Position (which only succeed when the position is
actually roll/convert-eligible, exactly matching the real submission
flow's own eligibility check) and Close & Replace (which works for any
open position). **The other 5 always honestly report themselves
unavailable**, with a clear, consistent, disclosed reason, rather than
being silently hidden or approximated. **There is no submit action
anywhere on this page — it is a dry-run only, and no adjustment can be
placed from it.**

The page shows the existing position, the proposed position, estimated
debit/credit, Greeks before/after, break-evens before/after, portfolio
exposure before/after (correctly modeling a *replace*, not an *add* —
unlike §6.11's Position Sizing page), and 6 side-by-side comparisons
(max risk, max reward, buying power impact, margin impact, risk/reward
ratio, concentration), each explicitly labeled Improved, Worse, or
Neutral — plus a 9-item risk-warnings list.

**Existing `buildAdjustmentTicket()` and `previewOptionOrder()` logic is
reused completely unchanged** — this page calls the exact same functions
the real roll/convert/order-preview flows already call, unmodified. **No
execution logic was modified. No order-routing logic was modified. No
broker writes occur. No orders or adjustments are submitted. Portfolio
impact remains hypothetical only** — the "after" exposure is always a
simulated reconstruction, never confused with a real position change.
**Real Alpaca credential verification remains deferred** — this page's
figures are computed the same way every other page in this integration
computes them today: from local trade data and this platform's own
deterministic SIMULATED pricing engine, not a live broker call.

Full detail: `docs/Alpaca-Paper-Trading-Architecture.md` §4.10 and
`docs/Trade-Adjustment.md`.

---

## 7. Escalation

1. **First response:** consult this handbook's own §2–§6 for anything routine.
2. **An active alert in `GET /api/monitoring/status`:** consult `docs/Incident-Response-Runbook.md` §2 for the specific category.
3. **Anything touching a protected file** (`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, `autoAdjustment.ts`) **as a candidate fix:** this requires the project owner's own explicit, separately-approved decision — no operator, however senior, may make this call unilaterally, per `CLAUDE.md` rule 2, restated identically in the incident runbook and the rollout plan.
4. **Anything involving real money moving unexpectedly:** disarm the kill switch (§6.1) immediately, first, before any further diagnosis — this is never the wrong first move, even if it later turns out the automation was behaving correctly.
5. **A genuine data-loss or database-corruption event:** `docs/Production-Rollout-Plan.md` §4.2 (Recovery Procedure).

**This handbook does not define a specific human escalation chain (names, phone numbers, paging rotations)** — that is inherently deployment-specific and outside what a codebase-level document can specify; the project owner should fill this in for whatever real team eventually operates a production deployment.

---

## 8. Cross-References

- `docs/Broker-Health-API.md` — the Alpaca Paper Trading broker/account read-only verification API referenced in §6.5 above.
- `docs/Alpaca-Paper-Trading-Architecture.md` — the full Alpaca integration picture (order submission, Broker Health, Order Lifecycle & Reconciliation, the Paper Portfolio Dashboard, Trade History/Performance Analytics, the Order Preview & Risk Simulator, the Position Sizing & Portfolio Impact Calculator, and the Trade Adjustment & Roll/Convert Preview Simulator), including the reconciliation panel referenced in §6.6, the portfolio dashboard referenced in §6.8, the Trade History/Performance pages referenced in §6.9, the Order Preview page referenced in §6.10, the Position Sizing page referenced in §6.11, and the Trade Adjustment Preview page referenced in §6.12 above.
- `docs/Trade-Adjustment.md` — the Trade Adjustment & Roll/Convert Preview Simulator's own full detail (§6.12 above): the 3-computable/5-honestly-unavailable intent scope decision, the Close & Replace composition, the replace-semantics portfolio exposure model, the 9-category risk-warnings list, and the Improved/Worse/Neutral comparison design.
- `docs/Trading-Journal.md` — the Trading Journal system's own full detail, referenced in §6.9 above.
- `docs/Order-Preview.md` — the Order Preview & Risk Simulator's own full detail, referenced in §6.10 above.
- `docs/Position-Sizing.md` — the Position Sizing & Portfolio Impact Calculator's own full detail, referenced in §6.11 above.
- `docs/Incident-Response-Runbook.md` — per-alert-category diagnosis and recovery.
- `docs/Production-Rollout-Plan.md` — the one-time go-live procedure and backup/recovery details this handbook's §6/§7 draw on.
- `docs/Production-Readiness-Report.md` — current-state readiness assessment.
- `.agents/memory/auto-execution-engine.md` / `trade-adjustment-engine.md` — the full engineering-level precedence rules for the kill switch, referenced but not duplicated in §6.1 above.
- `.env.example` — the authoritative environment-variable inventory referenced in §5.
