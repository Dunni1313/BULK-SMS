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
- [ ] Delete any merged feature branch still lingering on `origin` that this session's own tooling couldn't remove (§6.25 below) — check `git branch -a` / the repository's branch list for anything already merged into `main`.

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

### 6.13 Using the Portfolio Stress Test & Scenario Simulator

The "Stress Test" nav item (`/stress-test`) lets a user build one or
more hypothetical scenarios — an underlying price change (±1/2/5/10% or
a custom %), an implied-volatility change (±5/10/20% or a custom %),
and/or time decay (+1/7/14/30 days or a custom number of days), any
combination of which can be combined into a single scenario — and see
the full impact against their **current open portfolio**: portfolio
value before/after, unrealized P/L impact, buying power impact
(estimated — honestly always zero for this platform's defined-risk
strategies, see below), Greeks before/after and their deltas, exposure
by symbol/strategy, a risk score before/after, largest losing/gaining
position, positions breaching the configured per-trade risk threshold,
concentration changes, and portfolio drawdown. Four named quick presets
(Bullish, Bearish, High Volatility, Low Volatility) can be added to the
scenario queue with one click; running with an empty queue uses these
same four presets automatically. **There is no submit action anywhere
on this page — every result is a hypothetical, in-memory computation,
and nothing here ever places, closes, or modifies a real order.**

All pricing reuses this platform's existing options-math engine
(`optionsMath.ts`'s own `bs()`) via a new, shock-parameterized sibling of
`serverState.ts`'s existing `computeTradeGreeks()` — never a
modification of that function, and proven byte-identical to it at zero
shock. **Buying power impact is honestly always zero**: since every
supported strategy is a defined-risk spread, its reserved margin doesn't
move under a price/IV/time shock — only the position's current mark-to-
market value does; this is a real, disclosed structural fact, not an
unimplemented feature.

Full detail: `docs/Alpaca-Paper-Trading-Architecture.md` §4.11 and
`docs/Portfolio-Stress-Testing.md`.

### 6.14 Using the Earnings & Event Risk Portfolio Overlay

The "Event Risk" nav item (`/event-risk`) shows every current open
position together with its own upcoming earnings, dividend, and macro
(FOMC/CPI/jobs/economic-release) event risk before its own expiration —
symbol, strategy, quantity, portfolio weight, event status/type/date,
days remaining, risk level, confidence, event source, and last update —
plus a portfolio summary (positions with/without events, high-risk
count, 1/3/7/14-day countdown buckets, aggregate event exposure, and the
highest-risk position) and read-only Risk Guidance (Monitor / Consider
Review / Consider Adjustment / No Immediate Event Risk). **These
guidance labels are informational only — this page never generates an
execution recommendation, and there is no submit action anywhere on
it.**

All event data reuses this platform's existing, unmodified event-risk
engine (`getEventRiskForSymbol()`, the same function
`execution.ts`/`autoExecution.ts` already call for their own event-risk
gating) — no execution logic was modified, no broker writes occur, and
no orders are submitted. **This platform's event-risk engine covers 7
categories (earnings, dividends, FOMC, CPI, jobs, economic releases,
and a currently-inert "news" category) — it does not, and per this
project's own "do not invent new event models" discipline never will
without a real data source, cover FDA decisions or product launches**;
the page's own "Event Categories" card discloses this honestly rather
than silently omitting it. Every event is labeled `SIMULATED` — there is
no live earnings/dividend/macro-calendar provider anywhere in this
codebase.

Full detail: `docs/Alpaca-Paper-Trading-Architecture.md` §4.12 and
`docs/Portfolio-Event-Risk.md`.

### 6.15 Using the Correlation & Concentration Risk Overlay

The "Concentration Risk" nav item (`/concentration-risk`) shows a
portfolio-wide view of concentration and correlation risk: total
portfolio value, net Greeks, net directional exposure, and net beta
(always honestly disclosed as unavailable — no beta figure exists
anywhere in this engine's data model); concentration broken down by
symbol, underlying, sector, strategy, expiration, asset class, and
directional bias, each scored via a standard Herfindahl-Hirschman Index;
categorical correlation clusters (positions genuinely sharing an
underlying/sector/strategy/expiration/directional bias, never a
statistical correlation coefficient); a Portfolio Summary (largest
concentration, highest directional exposure, highest Greeks contributor,
most/least diversified area, concentration/diversification scores,
portfolio health indicator); and read-only Risk Guidance (Well
Diversified / Moderate Concentration / High Concentration / Review
Exposure, plus an independent Monitor Sector Concentration advisory).
**This page never generates an execution recommendation, and there is no
submit action anywhere on it.**

All portfolio and Greeks figures reuse this platform's existing,
unmodified `currentOpenTrades()` / `buildSnapshot()`
(`lib/positionSizing.ts`) and `computeTradeGreeks()`
(`lib/serverState.ts`) — no execution logic was modified, no broker
writes occur, and no orders are submitted. **Sector classification uses
a small, hand-curated table of real, publicly-known sector labels for
this engine's own fixed symbol universe** (the same categorical-metadata
precedent Engine 1's own `lib/industryPeers.ts` already established) —
any symbol outside that table honestly shows `"Unclassified"`. Every
response discloses its own `sectorDataSource` so this is never mistaken
for a live classification feed.

Full detail: `docs/Alpaca-Paper-Trading-Architecture.md` §4.13 and
`docs/Portfolio-Correlation-Concentration.md`.

### 6.16 Using the Portfolio Risk Dashboard

The "Portfolio Dashboard" nav item (`/portfolio-dashboard`) is the
single executive view unifying every overlay in this family: an
Executive Summary (Portfolio Value, Buying Power, Total Risk, a 0–100
Portfolio Health Score with gauge, Overall Risk Rating, Paper Trading
Status, Broker Status, Last Portfolio Update); a Portfolio Health Score
breakdown (8 factors — Concentration, Diversification, Event Risk, Net
Greeks Exposure, Directional Exposure, Position Sizing Quality, Number
of Positions, Expiration Distribution — each sortable/filterable and
each disclosing exactly which existing calculation it was derived
from); Risk Panels (Net Delta/Gamma/Theta/Vega, Largest Position,
Largest Risk Contributor, Highest Event Risk, Highest Concentration,
Highest Directional Exposure); 7 widget cards (Position Sizing, Stress
Test, Event Risk, Concentration, Diversification, Greeks, Broker
Health), each linking to its own existing detailed page; and
visualisations (Portfolio Allocation, Concentration Snapshot, Event
Timeline Summary, Stress Test Summary). **This page never generates an
execution recommendation, and there is no submit action anywhere on
it.**

Every figure is a direct, unmodified reuse of the 4 prior overlays in
this family (Position Sizing, Portfolio Stress Test, Event Risk,
Concentration) — **no execution logic was modified, no broker writes
occur, and no orders are submitted.** Per this sprint's own explicit "do
not invent statistical models" instruction, every Health Score factor
projects an already-computed figure onto a 0–100 health scale; only 2
small, disclosed, named threshold constants are genuinely new (an
event-risk-level→score table and a 5-position "healthy count"
threshold).

Full detail: `docs/Alpaca-Paper-Trading-Architecture.md` §4.14 and
`docs/Portfolio-Dashboard.md`.

### 6.17 Using the Institutional Command Center (primary landing page)

The application now opens on the **Command Center** (`/`) — a single
executive workspace consolidating Executive Overview, Portfolio Health
(the 7 widget cards from the Portfolio Risk Dashboard), the Options
Income Engine (Total Premium Collected, Expected Monthly Income, Iron
Condor/Calendar Spread counts, with an honest "Not tracked in this
engine" disclosure for Wheel Positions/Covered Calls/Cash Secured Puts),
Greeks Summary, Risk Alerts (the highest-priority alerts only, reused
from Concentration/Event Risk/Stress Test), Portfolio Allocation (4
charts), Broker status (cached, never auto-fetched), and AI Insights (a
deterministic, non-LLM summary — Largest Risk, Largest Opportunity,
Concentration, Diversification, Income Status). **Every card links to
its own existing detailed page. This page never generates an execution
recommendation, and there is no submit action anywhere on it.**

The pre-existing Options Income Engine dashboard (the platform's
original `/` page) was **not modified** and remains fully available at
the "Options Dashboard" nav item (`/options-dashboard`). **This sprint
made zero new backend calculations** — every figure on the Command
Center reuses an existing `GET` request another page already makes; the
one exception is a small, additive extension surfacing the Concentration
overlay's own already-computed `netBeta`/`netBetaUnavailableReason` on
the Portfolio Dashboard's own response, needed for an honest Beta
disclosure without a second network call.

Full detail: `docs/Alpaca-Paper-Trading-Architecture.md` §4.15 and
`docs/Institutional-Command-Center.md`.

---

### 6.18 Using the Institutional Intelligence Engine

A new nav item, **Institutional Intelligence** (`/institutional-intelligence`),
surfaces a **deterministic** intelligence layer over the platform's own
already-computed analytics — Portfolio Health, Theta Income,
Concentration, Event Risk, and Broker status. **This is not an LLM
integration, a chatbot, or a statistical prediction engine.** Every
observation shown carries a severity, a plain-language explanation, the
existing source module it was derived from, a confidence band (`"high"`
or `"moderate"` — never an AI-style probability), and a link to a real,
existing educational page. The page always shows 4 permanent badges
("Institutional Intelligence", "Deterministic Analysis", "Paper
Trading", "Read Only") and never generates a trade recommendation or
execution suggestion of any kind.

The page's Executive Summary and Health Overview mirror the exact same
Health Score `pages/PortfolioDashboard.tsx` already computes — never a
second, competing score. Its Intelligence Timeline compares today's
observations against the most recently recorded prior day's snapshot
(`intelligence_snapshots`, at most one row per user per calendar day) —
on a user's very first visit, no trend observations are shown at all,
by design, since a genuine trend needs two real data points.

Full detail: `docs/Alpaca-Paper-Trading-Architecture.md` §4.16 and
`docs/Institutional-Intelligence-Engine.md`.

### 6.19 Using the AI Teacher & Learning Centre

A new nav section (**AI Teacher & Learning Centre**, **Learning
Paths**, **Strategy Academy**, **Glossary** — under the existing "Coach
& Learn" group, alongside the pre-existing Delta Masterclass/Greeks
Tutor/Trading Quiz/Trade Lessons/Value Investing School items, all
unchanged) surfaces a unified, **deterministic** educational layer:
`/learn` (the hub — Overview, Simulations, My Portfolio Explained,
Progress tabs), `/learn/paths/:pathKey`/`:topicKey` (7 structured
Learning Paths, 47 topics), `/learn/strategy-academy/:strategy` (8
strategies, 3 with a real live worked example), and
`/learn/glossary/:key` (~52 cross-linked terms). **This is not an LLM
integration** — every piece of content is a plain, version-controlled
TypeScript literal, never generated.

A new **Explain** button appears next to major metrics on the Portfolio
Dashboard, Portfolio (Greeks), and Trades pages — click it to see the
metric's real current value, a plain-English explanation, its source
calculation, why it matters, and links to a related lesson/glossary
term. It genuinely reuses the Institutional Intelligence Engine's own
Explanation Engine (§6.18) whenever a real observation is currently
active for that metric.

The Learning Centre's "My Portfolio, Explained" tab uses the operator's
own real, current Paper Trading portfolio as an educational example
(e.g. "Your portfolio Delta is +42, here's why it matters") — it never
recommends a trade. The "Simulations" tab runs deterministic
educational simulations (Delta, Theta, Expected Move, 3 payoff
diagrams, Concentration) — always labeled "Educational Simulation / Not
Market Data / No Trade Recommendation." The "Progress" tab shows
lessons/glossary/strategies viewed and completed, per-path completion,
and both quiz systems' (Greeks + Value Investing) streak/score history
in one place — reused, never duplicated, from each quiz's own results
table.

**The only user-state mutation this feature introduces**: viewing or
completing a lesson/glossary term/path/strategy writes one row to
`learning_progress` (upserted, never a growing log). No broker write,
no order execution, no portfolio mutation of any kind occurs anywhere
in this feature.

Full detail: `docs/Alpaca-Paper-Trading-Architecture.md` §4.17 and
`docs/AI-Teacher-Learning-Centre.md`.

### 6.20 Using the AI Portfolio Analyst

A new nav item, **AI Portfolio Analyst** (`/portfolio-analyst`), is the
executive portfolio briefing layer — one page transforming every
existing analytic into concise institutional-quality intelligence:
Executive Daily Briefing, Portfolio Snapshot, Health/Risk/Income/
Performance/Greeks/Event/Learning Summaries, a Portfolio Timeline
(Yesterday/Today/This Week), and deterministic Institutional Insights.
**This is not an LLM, a chatbot, predictive AI, financial advice, or a
trade-recommendation engine.** The page always shows 5 permanent badges
("AI Portfolio Analyst", "Institutional Intelligence", "Deterministic
Analysis", "Paper Trading", "Read Only") and never generates a trade
recommendation or execution suggestion of any kind.

Nine of the page's ten sections read this account's own real Paper
Trading positions (the same `buildPortfolioDashboard()`/
`buildPortfolioEventRiskOverlay()`/theta-income figures every other page
in this handbook already draws on). **The Performance Summary card is
the one deliberate exception** — it is explicitly labeled "SIMULATED"
and reuses the pre-existing Performance Analytics engine's own
deterministic, seeded sample-trade population (`docs/Alpaca-Paper-Trading-Architecture.md`
§4.9's own "Trade History, Trade Performance" coverage), never this
account's own real trade history. Net Liquidation and Daily P/L reuse
the same real `GET /portfolio/summary` figures the Institutional Command
Center already shows.

Full detail: `docs/Alpaca-Paper-Trading-Architecture.md` §4.18 and
`docs/AI-Portfolio-Analyst.md`.

### 6.21 Using the AI Trade Journal

A new nav item, **AI Trade Journal** (`/trade-journal-ai`), is a
deterministic behavioural analysis and trade review system: every
completed Paper Trading trade gets a Trade Review (strategy, holding
period, P/L, Greeks at entry/exit, Event Risk at entry, position size,
and Decision Quality tags — each tag naming the real rule it came from,
e.g. "Position Sizing Respected" cites `settings.maxRiskPerTrade`).
**This is not a chatbot, an AI trading signal engine, financial advice,
or portfolio management.** The page always shows 5 permanent badges
("AI Trade Journal", "Behaviour Analysis", "Deterministic Review",
"Paper Trading", "Educational Only") and never generates a trade
recommendation of any kind — only education.

The page's Behaviour Analysis section (Strengths / Areas to Improve)
surfaces repeatable patterns over the caller's own real closed-trade
history (e.g. "Excessive Concentration," "Stable Position Sizing") —
every pattern names the real trade count and ratio it's based on, and
none appear until at least 3 closed trades exist. Learning
Recommendations link each concerning pattern to a real Learning Centre
lesson, Glossary term, or Strategy Academy page — never a trade
recommendation. The Journal Timeline shows real trade-opened/
trade-closed/learning-completed events with real timestamps — no
fabricated event. Trade Reviews also surface the caller's own
already-existing linked journal entry (from the pre-existing, free-text
Trading Journal, §6.9) when one exists — read-only, never a duplicate
write.

Full detail: `docs/Alpaca-Paper-Trading-Architecture.md` §4.19 and
`docs/AI-Trade-Journal.md`.

### 6.22 Using the Institutional Mentor

A new nav item, **Institutional Mentor** (`/institutional-mentor`), is
the final intelligence layer: it teaches the user how a professional
portfolio manager would evaluate their own existing Paper Trading
portfolio, composing the Portfolio Dashboard, Correlation &
Concentration overlay, Portfolio Stress Test, and the AI Trade Journal
(§6.21) into a 9-category **Portfolio Scorecard** (Capital Allocation,
Risk Management, Diversification, Discipline, Income Generation,
Position Sizing, Greeks Management, Event Preparation, Portfolio
Health — each score cites the real `sourceModule` it came from), a
**Professional Review** (deterministic, institutional-PM-voice
observations, e.g. "Risk remains moderate."), a **Decision Review**
(e.g. "Position sizing followed plan."), and narrative **Capital
Allocation / Risk / Income / Behaviour Reviews**. **This is not a
chatbot, an AI trading signal engine, financial advice, portfolio
optimisation, or execution logic.** The page always shows 5 permanent
badges ("Institutional Mentor", "Professional Portfolio Review",
"Deterministic Analysis", "Paper Trading", "Educational Only") and
never generates a trade recommendation of any kind — only education.

Every section ends with an **Institutional Lessons** cross-link — a
real Learning Centre lesson, Strategy Academy page, Glossary entry, and
an Explain Mode link (`/learn?tab=portfolio`) — reusing the exact same
lesson/glossary catalog the AI Portfolio Analyst (§6.20) already uses.
Unlike the AI Portfolio Analyst, this page never writes to
`intelligence_snapshots` — it only reads the already-recorded daily
snapshot history for its own real 7-day Diversification trend.

Full detail: `docs/Alpaca-Paper-Trading-Architecture.md` §4.20 and
`docs/Institutional-Mentor.md`.

---

### 6.23 Using Institutional Home, Workspaces, the Command Palette, and the Notification Centre

**Phase 10 (Institutional Platform Polish & Control Center)** added a
platform-organization layer on top of every feature above — it changes
none of them.

The application now opens on **Institutional Home** (`/`) — a
13-widget Personal Dashboard (Portfolio Health, Market Status, Open
Positions, Today's P/L, Theta Income, Buying Power, Risk, Upcoming
Events, AI Briefing, Mentor Summary, Recent Activity, Notifications,
Quick Actions), every widget reused from an already-existing page's
own data. The pre-existing **Institutional Command Center** (§6.17)
was not modified and remains fully available at `/command-center`.

**Workspaces**, saved from the header's Workspace Switcher, are named
snapshots of the Home page's own widget arrangement (which widgets are
visible, in what order, at what size). "Edit Layout" mode exposes
Move Up / Move Down (reorder) and Normal/Compact (resize) controls per
widget; "Save Layout" persists the arrangement to the active workspace.
A user can create, rename, duplicate, delete, or switch workspaces —
deleting a user's only remaining workspace is refused (`400`), and an
account always has exactly one active workspace at a time, enforced at
the database level.

The **Command Palette** (⌘K / Ctrl+K, or the header's "Search or jump
to…" button) is this platform's Global Search — it searches pages,
open positions, journal entries, lessons, strategies, glossary terms,
and AI observations, and runs Quick Actions (Open Scanner, Run Stress
Test, Review Portfolio, Open AI Mentor, Review Journal, Learning
Centre, Strategy Academy, Export Portfolio — the last is a genuine,
read-only CSV download of the user's own open positions, computed
entirely client-side).

The **Notification Centre** (`/notifications`) is a full read-only
aggregation across 7 categories (Alerts, Health Changes, Risk,
Learning, Journal, Upcoming Earnings, Expirations), distinct from and
linked to the header's own `NotificationBell` popover. Every item is a
factual statement about already-existing data — **this page never
generates a recommendation.**

Full detail: `docs/Institutional-Control-Center.md`.

---

### 6.24 Using the Operations Dashboard (administrators only)

**Phase 11 (Live Market Operations & Production Validation)** added `/operations` — an administrator-only page (`role = 'admin'`, gated server-side via `requireAdmin` and client-side for UX) showing API health, broker health, background-job scheduler health ("Queue Status" — honestly labeled, since this platform has no real message queue, only scheduler ticks), active alerts, live market data validation ("Data Freshness" — one consolidated read across the Options Engine, Engine 1, and Engine 2's own already-existing provider-status systems, plus a new US market clock/calendar), and recent broker reconciliation history with a "Run Reconciliation Now" button.

There is no self-service way to become an administrator — see `docs/Operations-Runbook.md` §2 for the manual database action required.

Full detail: `docs/Operations-Runbook.md`, `docs/Live-Market-Validation.md`, `docs/Broker-Reconciliation.md`.

### 6.25 Repository / Git housekeeping (manual, human-only)

This development environment's git proxy accepts pushes to branches (including merges) but rejects certain other ref operations — confirmed for remote tag pushes (`docs/GitHub-Release-v1.0.0.md`, `docs/GitHub-Release-v1.1.0.md`) and now also for remote branch deletion. When a feature branch is merged via Pull Request from this environment, the local copy of that branch is deleted automatically, but **the remote copy on `origin` is not** — it must be removed manually, either via:

- the "Delete branch" button GitHub shows on a merged PR's own page, or
- `git push origin --delete <branch-name>` run from a machine with real, non-proxied push credentials.

**Currently pending:** `v1.3.1-ai-trading-coach-ui` (merged into `main` via PR #6, commit `621ff40`, on 2026-07-26). This is purely cosmetic housekeeping — the branch is fully merged, `main` already contains every one of its commits, and its continued existence on `origin` has no functional effect on the running platform. Remove it the next time a maintainer has direct (non-proxied) push access, or during the next Monthly Operations pass (§4).

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

- `docs/Phase-9-Production-Readiness-Report.md`, `docs/Phase-9-Technical-Debt-Report.md`, `docs/Phase-9-Performance-Report.md`, `docs/Phase-9-Security-Review.md`, `docs/Phase-9-Deployment-Checklist.md`, `docs/Phase-9-Release-Checklist.md` — this session's own Phase 9 (Production Readiness & Release Candidate) hardening pass: a global frontend error boundary, a global backend error-handling middleware, process-level crash handlers, a dependency-free security-headers middleware, an explicit database connection pool configuration, 3 new database indexes, a batched seed-trade insert, and the removal of 27 confirmed-unused frontend component files — zero trading-calculation, execution, broker-integration, or portfolio-calculation logic touched. These 6 documents are deliberately `Phase-9-`-prefixed to avoid colliding with this repository's other, separately-numbered documentation thread (`docs/Production-Readiness-Report.md`, `docs/Production-Rollout-Plan.md`, and the `Phase-1` through `Phase-6` planning documents), which covers a different sprint sequence over the same codebase and was not modified by this phase.
- `docs/Broker-Health-API.md` — the Alpaca Paper Trading broker/account read-only verification API referenced in §6.5 above.
- `docs/Alpaca-Paper-Trading-Architecture.md` — the full Alpaca integration picture (order submission, Broker Health, Order Lifecycle & Reconciliation, the Paper Portfolio Dashboard, Trade History/Performance Analytics, the Order Preview & Risk Simulator, the Position Sizing & Portfolio Impact Calculator, the Trade Adjustment & Roll/Convert Preview Simulator, the Portfolio Stress Test & Scenario Simulator, the Earnings & Event Risk Portfolio Overlay, the Correlation & Concentration Risk Overlay, the Portfolio Risk Dashboard & Health Score, the Institutional Command Center, the Institutional Intelligence Engine, the AI Teacher & Learning Centre, the AI Portfolio Analyst, the AI Trade Journal, and the Institutional Mentor), including the reconciliation panel referenced in §6.6, the portfolio dashboard referenced in §6.8, the Trade History/Performance pages referenced in §6.9, the Order Preview page referenced in §6.10, the Position Sizing page referenced in §6.11, the Trade Adjustment Preview page referenced in §6.12, the Portfolio Stress Test page referenced in §6.13, the Portfolio Event Risk page referenced in §6.14, the Correlation & Concentration Risk page referenced in §6.15, the Portfolio Risk Dashboard referenced in §6.16, the Institutional Command Center referenced in §6.17, the Institutional Intelligence Engine referenced in §6.18, the AI Teacher & Learning Centre referenced in §6.19, the AI Portfolio Analyst referenced in §6.20, the AI Trade Journal referenced in §6.21, and the Institutional Mentor referenced in §6.22 above.
- `docs/Institutional-Intelligence-Engine.md` — the Institutional Intelligence Engine's own full detail (§6.18 above): the 6-service architecture (Observation, Explanation, Health, Summary, Timeline, Learning Engines), the 11 deterministic observation rules, the confidence-banding discipline (never an AI-style probability), the `intelligence_snapshots` table's history-keeping design, and the remaining AI roadmap this engine is the foundation for.
- `docs/AI-Teacher-Learning-Centre.md` — the AI Teacher & Learning Centre's own full detail (§6.19 above): the 7 structured Learning Paths, the 8-entry Strategy Academy, the ~52-term Glossary, Contextual Explain Mode's reuse of the Institutional Intelligence Engine's own Explanation Engine, Portfolio Learning Mode, the 5 deterministic Interactive Simulations, the unified Learning Progress tracking (the only new user-state mutation), and the reunification of the Greeks quiz and Value Investing quiz into one shared progress system.
- `docs/AI-Portfolio-Analyst.md` — the AI Portfolio Analyst's own full detail (§6.20 above): the executive portfolio briefing layer's pure-composition architecture over the Institutional Intelligence Engine/Portfolio Dashboard/Portfolio Event Risk/Theta Income, the sequential-not-`Promise.all` `getSettingsRow()` race fix, the new "This Week" 7-day rollup, and the disclosed SIMULATED-vs-real engine boundary for the Performance Summary section.
- `docs/AI-Trade-Journal.md` — the AI Trade Journal's own full detail (§6.21 above): the deterministic Trade Review/Decision Quality/Behaviour Analysis architecture, the disclosed historical-date generalization of `computeTradeGreeks()` for Greeks at Entry/Exit, the genuine historical reconstruction of Event Risk at Entry via `getEventRiskForSymbol()`'s own existing `now` override, and the read-only reuse of the pre-existing, free-text Trading Journal's own linked entries.
- `docs/Institutional-Mentor.md` — the Institutional Mentor's own full detail (§6.22 above): the 9-category Portfolio Scorecard architecture (each score cited to a real `sourceModule`), the Professional Review/Decision Review deterministic template techniques, the Capital Allocation/Risk/Income/Behaviour narrative reviews, the Institutional Lessons cross-link pattern (including the Explain Mode link), the disclosed Income Generation threshold-banding constants, and the confirmation that this module never writes to `intelligence_snapshots`.
- `docs/Trade-Adjustment.md` — the Trade Adjustment & Roll/Convert Preview Simulator's own full detail (§6.12 above): the 3-computable/5-honestly-unavailable intent scope decision, the Close & Replace composition, the replace-semantics portfolio exposure model, the 9-category risk-warnings list, and the Improved/Worse/Neutral comparison design.
- `docs/Portfolio-Stress-Testing.md` — the Portfolio Stress Test & Scenario Simulator's own full detail (§6.13 above): the shock-parameterized repricing engine, the portfolio-level aggregation model, the honestly-always-zero buying-power-impact disclosure, the risk-score formula, the risk-analysis fields, and the scenario-comparison design.
- `docs/Portfolio-Event-Risk.md` — the Earnings & Event Risk Portfolio Overlay's own full detail (§6.14 above): the honest disclosure of the 2 requested-but-unsupported event categories (FDA decisions, product launches), the direct event-risk-engine reuse, the Risk Guidance label mapping, the confidence/source disclosure model, and the portfolio summary derivation.
- `docs/Portfolio-Correlation-Concentration.md` — the Correlation & Concentration Risk Overlay's own full detail (§6.15 above): the always-unavailable net-beta disclosure, the `KNOWN_SECTOR_MAP` categorical-metadata precedent, the concentration-weight-vs-portfolio-weight distinction, the Herfindahl-Hirschman-Index concentration scoring, the categorical-clustering-only correlation model, and the Portfolio Summary/Risk Guidance derivation.
- `docs/Portfolio-Dashboard.md` — the Portfolio Risk Dashboard & Health Score's own full detail (§6.16 above): the 8-factor Health Score derivation table, the equal-weighted averaging formula, the 4-tier Overall Risk Rating banding, the 7 dashboard widgets, and the disclosed `getSettingsRow()` concurrency fix.
- `docs/Institutional-Command-Center.md` — the Institutional Command Center's own full detail (§6.17 above): the per-section data-source table, the disclosure distinguishing this page from the pre-existing `/institutional-dashboard`, the honest "not tracked in this engine" disclosure for Wheel Positions/Covered Calls/Cash Secured Puts, the one small additive `netBeta` backend extension, and the navigation changes that install it as the primary landing page.
- `docs/Trading-Journal.md` — the Trading Journal system's own full detail, referenced in §6.9 above.
- `docs/Order-Preview.md` — the Order Preview & Risk Simulator's own full detail, referenced in §6.10 above.
- `docs/Position-Sizing.md` — the Position Sizing & Portfolio Impact Calculator's own full detail, referenced in §6.11 above.
- `docs/Incident-Response-Runbook.md` — per-alert-category diagnosis and recovery.
- `docs/Production-Rollout-Plan.md` — the one-time go-live procedure and backup/recovery details this handbook's §6/§7 draw on.
- `docs/Production-Readiness-Report.md` — current-state readiness assessment.
- `.agents/memory/auto-execution-engine.md` / `trade-adjustment-engine.md` — the full engineering-level precedence rules for the kill switch, referenced but not duplicated in §6.1 above.
- `.env.example` — the authoritative environment-variable inventory referenced in §5.
- `docs/Institutional-Control-Center.md` — Phase 10 (Institutional Platform Polish & Control Center)'s own full detail, referenced in §6.23 above: Institutional Home's 13-widget Personal Dashboard, the Workspace System's own 7 routes and its active-workspace database guarantee, the Global Command Palette / Global Search dialog, the shared Quick Actions list, and the Notification Centre's 7-category read-only aggregation.
- `docs/UI-Standards.md` — the codebase's own already-established frontend conventions (loading/error/empty states, badge-color semantics, spacing, typography), formalized as this phase's Consistency Review deliverable.
- `docs/Operations-Runbook.md` — Phase 11 (Live Market Operations & Production Validation)'s own SRE/on-call reference, referenced in §6.24 above: the background-job audit (only 5 real scheduled processes exist platform-wide), administrator promotion, the Operations Dashboard, and the security review.
- `docs/Live-Market-Validation.md` — the cross-provider live market data validation report and the new US market calendar/clock, referenced in §6.24 above.
- `docs/Broker-Reconciliation.md` — the persisted reconciliation-reports history built on top of the existing, unmodified live reconciliation comparison, referenced in §6.24 above.
- `docs/Production-GoLive-Checklist.md` — the current, consolidated go/no-go checklist incorporating this phase's own findings.
