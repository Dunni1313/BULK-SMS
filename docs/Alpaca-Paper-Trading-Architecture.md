# Alpaca Paper Trading — Architecture

This is the authoritative, whole-surface reference for how this platform
talks to Alpaca. It describes three layers, in the order they were built:
**order submission** (pre-existing, protected, unmodified by any of the
sprints this document covers), **Broker Health** (read-only account
verification), and **Order Lifecycle & Reconciliation** (read-only
order/position comparison). Read `docs/Broker-Health-API.md` for the
account-verification endpoint's own full detail and `docs/Operations-Handbook.md`
§6 for day-to-day operational usage — this document's job is the complete
picture and the design rationale, not a duplicate of either.

**Every sprint that produced the read-only layers described here was
completed without real Alpaca credentials.** `ALPACA_API_KEY`/
`ALPACA_API_SECRET` are confirmed unset in every session that built this —
verified by direct inspection of `process.env` and every `.env*` file on
disk each time, the same standing disclosure this project has made at every
credential-gated milestone since Phase 2 Sprint 11. **Real Alpaca Paper
account verification remains explicitly deferred.** Nothing described below
has been exercised against a real account; every success/failure path was
proven with mocked HTTP responses over the real route/service code, per each
sprint's own as-built disclosure (see §7 for the exact test inventory).

## 1. The three layers

```
┌─────────────────────────────────────────────────────────────┐
│  1. Order submission (execution.ts) — WRITE, protected       │
│     POST https://paper-api.alpaca.markets/v2/orders          │
│     Untouched by every sprint this document covers.          │
├─────────────────────────────────────────────────────────────┤
│  2. Broker Health (alpacaBroker.ts) — READ, account-level     │
│     GET /v2/account, /v2/positions, /v2/orders                │
├─────────────────────────────────────────────────────────────┤
│  3. Order Lifecycle & Reconciliation — READ, order-level      │
│     GET /v2/orders/{id}, /v2/orders?status=all,                │
│     /v2/positions/{symbol}                                    │
│     lib/brokerReconciliation.ts compares layer 3's data        │
│     against the local `trades` table                          │
└─────────────────────────────────────────────────────────────┘
```

All three layers target the exact same hardcoded host:
`https://paper-api.alpaca.markets`. **There is no live-trading URL anywhere
in this codebase** — not a constant, not an environment variable, not a
config toggle. Grepping the entire repository for `api.alpaca.markets`
(Alpaca's real live-trading host, as opposed to `paper-api.alpaca.markets`)
returns zero matches; this has been re-verified at every sprint that touched
this integration.

## 2. Layer 1 — Order submission (unmodified, protected)

`artifacts/api-server/src/lib/execution.ts` is the only place this platform
ever places an order. `routeOrder()` POSTs a multi-leg (`mleg`) limit order
to `ALPACA_ORDERS_URL` (the hardcoded Paper Trading orders endpoint) when
credentials are configured, or produces a deterministic mock acknowledgement
(`mock-<uuid>`) when they are not — this mock-fallback behavior, and every
other line of this file, predates and is untouched by every sprint this
document describes. `executeValidatedTicket()` persists the result to the
local `trades` table, storing the returned order id in `trades.alpaca_order_id`.

This is CLAUDE.md's own highest-scrutiny protected file — `execution.ts`,
`optionsMath.ts`, and `risk.ts` require explicit, specific approval for any
change, and none of the sprints in this document requested or received one.
Confirmed via `git diff --stat` at the close of every sprint: zero-line diff.

## 3. Layer 2 — Broker Health

Covered in full in `docs/Broker-Health-API.md`. Summary: `GET /api/broker/health`
performs a live, read-only, authenticated round trip to `/v2/account`,
`/v2/positions`, `/v2/orders` and reports connection status, account
balances, and open position/order counts. `settings.alpacaConnected` is
computed from the outcome of the most recent such check.

## 4. Layer 3 — Order Lifecycle & Reconciliation

### 4.1 Provider methods (`lib/providers/alpacaBroker.ts`)

Four read-only functions, all sharing `readAlpacaCreds()` and the same
`BrokerResult<T>` discriminated-union failure vocabulary
(`no_credentials`/`unauthorized`/`http_error`/`network_error`) Broker Health
already established:

| Function | Endpoint | Notes |
|---|---|---|
| `getAlpacaOrder(orderId)` | `GET /v2/orders/{order_id}` | A single order by id. A 404 (order not found) is an `http_error`, not a special case — an unrecognized id is a genuine caller error, unlike a missing position (see below). |
| `getAlpacaAllOrders()` | `GET /v2/orders?status=all` | Every order regardless of status, bounded to Alpaca's own default page size (no further pagination this sprint — a documented scope limit). Distinct from the pre-existing `getAlpacaOrders()` (open-only), which Broker Health's own `openOrdersCount` depends on and was left completely unchanged. |
| `getAlpacaPosition(symbol)` | `GET /v2/positions/{symbol}` | A single position by symbol. A 404 is treated as an honest `{ ok: true, data: null }` — "no position for this symbol" is a normal, expected outcome, not a failure. Implemented and independently unit-tested; the reconciliation service itself uses the bulk `getAlpacaPositions()` call instead (see §4.3), since it needs the whole account's position set at once, not one symbol at a time — this method remains available for any future single-symbol lookup. |
| `getAlpacaPositions()` | `GET /v2/positions` | Pre-existing (Broker Health), unmodified — reused directly by reconciliation. |

Every order-returning function shares one mapper (`mapOrder()`) so the raw
Alpaca shape is normalized identically everywhere: numeric fields
(`qty`, `filled_qty`, `filled_avg_price`) parsed from Alpaca's own
string-encoded numbers, plus a `normalizedStatus` field (see §4.2).

### 4.2 Normalized order-lifecycle model (`lib/providers/alpacaOrderLifecycle.ts`)

Alpaca's own order-status vocabulary is larger and more granular than any
consumer of this platform needs to branch on individually. `normalizeAlpacaOrderStatus()`
maps it down to 9 named buckets:

```
new · accepted · pending · partially_filled · filled ·
cancelled · rejected · expired · unknown
```

| Normalized bucket | Alpaca raw statuses mapped to it |
|---|---|
| `new` | `new` |
| `accepted` | `accepted`, `accepted_for_bidding`, `calculated` |
| `pending` | `pending_new`, `pending_cancel`, `pending_replace`, `stopped`, `suspended` |
| `partially_filled` | `partially_filled` |
| `filled` | `filled` |
| `cancelled` | `canceled` (Alpaca's own spelling), `cancelled` |
| `rejected` | `rejected` |
| `expired` | `expired` |
| `unknown` | anything else, including a status string this mapping doesn't recognize (a future Alpaca API addition) — never guessed into one of the 8 named buckets |

The local `trades` table's own coarser status vocabulary (`pending`/`open`/
`closed`) is normalized the same way (`normalizeLocalTradeStatus()`), and a
small, deliberately narrow `isStatusContradiction()` function flags only 2
genuinely unambiguous local-vs-broker contradictions — a local `open`/`closed`
trade whose broker order was actually `rejected`/`cancelled`/`expired`, or a
local `pending` trade whose broker order actually `filled` (a stale local
record). Every other combination is treated as consistent rather than
guessed as a mismatch — this is a deliberately conservative rule set for a
foundation sprint, not an exhaustive order-state machine.

### 4.3 The reconciliation service (`lib/brokerReconciliation.ts`)

`buildReconciliation(userId, settingsApiKey)` is the one entry point. It is
**read-only end to end**: it only ever issues `GET` requests (via
`alpacaBroker.ts`) and a single `SELECT` against the local database — no
`INSERT`/`UPDATE`/`DELETE` of any kind, no order cancellation, no position
closing, no automatic correction of any local record. It is called only from
an explicit route handler (`GET /api/broker/reconciliation`), itself only
called on an explicit user action (page load or the Refresh button) — nothing
in this module runs on a timer, cron, or background schedule.

**Scope, deliberately narrow and disclosed (a "foundation" sprint, not a
complete reconciliation engine):**

- Only local trades whose `status` is `"pending"` or `"open"` are
  considered — a `"closed"` trade's opening order has already fully settled
  and is not re-flagged forever.
- Only trades with a real (non-`mock-`-prefixed) `alpacaOrderId` are
  "trackable." `execution.ts` assigns a `mock-<uuid>` id when no broker
  credentials were configured at submission time — such a trade was never
  actually sent to Alpaca, so comparing it against Alpaca's own data would
  be comparing against something that was never there by design, not a
  genuine discrepancy.
- Local spread quantity is derived from `StoredLeg.quantity`, assuming
  uniform-ratio legs (every leg's own ratio is 1) — what `optionsMath.ts`'s
  strategy builders currently produce for every supported strategy. A future
  ratio-spread strategy would need this assumption revisited.
- Symbol comparison is a direct, case-insensitive match against Alpaca's own
  top-level order `symbol` field. This has **not** been independently
  verified against a real multi-leg (`mleg`) Alpaca order response, since no
  real credentials exist in any session that built this — if Alpaca's real
  `mleg` order symbol field turns out to use a different convention (e.g.
  the first leg's OCC symbol, or blank), this specific check may need
  revisiting once live verification happens (see §5).

**What it compares, and how:**

**Orders.** Every trackable local trade's `alpacaOrderId` is looked up
against the full broker order list (`getAlpacaAllOrders()`). For each pair
found:
- `status_mismatch` — via `isStatusContradiction()` (§4.2).
- `quantity_mismatch` — local derived spread quantity vs. the broker
  order's own top-level `qty`.
- `symbol_mismatch` — local trade symbol vs. broker order symbol.
- `filledQuantity`/`averageFillPrice` — read straight from the broker order,
  never recomputed or estimated.

A trackable local trade with no matching broker order → `missing_at_broker`.
A broker order with no matching trackable local trade → `missing_locally`.

**Positions.** Only genuinely `"open"` (i.e., observed to have filled)
trades contribute an expected position — a still-`"pending"` trade hasn't
been observed to fill yet, so no position is expected for it either way.
Each open trade's legs are converted to their own OCC symbol (via
`execution.ts`'s own exported, unmodified `toOcc()` helper — read, never
edited) and a signed quantity (positive = bought/long, negative =
sold/short), aggregated per symbol across all open trades. This is compared
against Alpaca's real, bulk `getAlpacaPositions()` result, symbol by symbol:
a local position with no matching broker position, a broker position with
no matching local trade, or a signed-quantity mismatch are all flagged.

**Overall result:** `available: false` (with an honest `unavailableReason`,
reusing the exact same phrasing Broker Health established) whenever
credentials are missing or either the orders or positions call fails —
never a partial or fabricated reconciled result in that case.
`fullyReconciled: true` only when `available` and zero issues were found
across every order and position entry. `generatedAt` doubles as the "last
reconciliation time," since reconciliation is computed fresh on every call —
no server-side cache exists for this (unlike Broker Health's
`lastSuccessfulCheckAt`, which exists specifically because
`settings.alpacaConnected` needs to be read passively elsewhere; nothing
else in this platform reads a "last reconciliation" value passively, so no
such cache was built).

### 4.4 Routes (`routes/brokerReconciliation.ts`)

| Route | Behavior |
|---|---|
| `GET /api/broker/orders` | Thin pass-through to `getAlpacaAllOrders()`. |
| `GET /api/broker/orders/:orderId` | Thin pass-through to `getAlpacaOrder()`. |
| `GET /api/broker/positions` | Thin pass-through to `getAlpacaPositions()` — added in the Paper Portfolio Dashboard sprint, see §4.6. |
| `GET /api/broker/reconciliation` | Thin pass-through to `buildReconciliation()`, resolving the calling user's own local trades and their `settings.alpacaApiKey`. |

All three always return HTTP `200` for a well-formed request — a
broker-side or connectivity failure is an honestly-reported *result*
(`available: false`, a reason string), not an error in this platform's own
API, exactly matching `GET /api/broker/health`'s own established contract.

### 4.5 UI — Paper Trading Reconciliation panel

New page, `/broker-reconciliation` (nav item "Broker Reconciliation").
**No distinct "admin" role exists anywhere in this platform** (confirmed —
see `docs/Operations-Handbook.md` §6.5's own disclosure that no role-based
admin functionality exists as of Sprint 77) — this page is reachable by any
signed-in user, scoped to their own account's own local trades, the same
per-user model every other page in this app already follows. It is not a
system-wide admin panel; "admin-facing" in the sprint's own request is
satisfied by it being an operational/diagnostic surface, not by a
permissions gate that doesn't exist to attach to.

Fetches on page load and via an explicit **Refresh** button — never on a
timer. While a fetch is in flight the button is disabled and shows a
spinner + "Refreshing..." label; it re-enables the moment the fetch
completes, success or failure. When `available: false`, the page still
renders fully and remains usable (the summary card shows the honest reason,
the order/position tables show their own honest "no data" messages, and
Refresh is still clickable) — it never presents a stale or fabricated
reconciled state. Three cards: a summary (fully-reconciled/issue-count
badge, counts, last-checked time), an order-reconciliation table (local vs.
broker status/quantity/fill side by side, with per-row issue badges), and a
position-comparison table (local vs. broker quantity, a matched/mismatch
badge, and a human-readable detail sentence).

### 4.6 The Paper Portfolio Dashboard — a pure composition over the other three layers

New page, `/paper-portfolio` ("Paper Portfolio" nav item). The one
genuinely new piece of backend surface this sprint added is
`GET /api/broker/positions` — a direct sibling of `GET /api/broker/orders`,
a thin pass-through to the already-existing `getAlpacaPositions()` function
(built in the very first Broker Health milestone, §3) — no new provider
logic of any kind. Everything else on this page is pure composition: it
fetches `GET /api/broker/health`, `GET /api/broker/positions`, and
`GET /api/broker/reconciliation` independently and renders them together,
cross-referencing the reconciliation result onto each position card
client-side (matching `position.symbol` against
`reconciliation.positions[].occSymbol`) — no new backend join, no new
comparison logic beyond what `buildReconciliation()` (§4.3) already
computes.

**"Keep all refreshes user-initiated only" is taken literally, and is
stricter than the Reconciliation panel's own design (§4.5), which fetches
once automatically on page load.** None of this page's three underlying
queries fetch on mount — each of the three sections (Account/Broker Health,
Portfolio, Reconciliation) independently shows an honest "Not yet checked"
placeholder until its own Refresh button (Refresh Broker Health, Refresh
Portfolio, Refresh Reconciliation) is clicked, and each button is
independently disabled — with its own spinner — only while its own request
is in flight; the other two sections remain fully interactive. There is no
polling, timer, or scheduled job anywhere on this page.

**Two P/L figures, one real and one honestly absent:**
- **Unrealized P/L** is computed client-side as the sum of every position's
  own `unrealizedPl` (an unmodified Alpaca field, §4.1) — but only once the
  Portfolio section has actually been checked successfully this session;
  before that, or if it's unavailable, the page shows "Not available"
  rather than a stale or zeroed number.
- **Realized P/L is always "Not available,"** on every load, with a
  disclosed one-line reason. Alpaca's realized profit/loss is not a field on
  either `/v2/account` or `/v2/positions` — it requires the portfolio
  history or account-activities endpoints, neither of which this platform
  fetches (no provider method for either was added this sprint, since none
  was requested and adding one to satisfy a "when available" display would
  have meant introducing new provider surface outside this sprint's own
  scope of "uses the existing Broker Health and Reconciliation APIs"). This
  is a real, structural gap — not a bug, and not something this dashboard
  papers over with an estimate.

Position cards show: Symbol, Quantity, Average Cost (`avgEntryPrice`),
Market Value, Unrealized P/L (all straight from `GET /api/broker/positions`,
unmodified), a Long/Short badge (from the position's own `side` field — this
is what "Current status" in the sprint's own request maps to), and a
Reconciliation badge — "Not yet checked" before the Reconciliation section
has ever been refreshed, "Not compared" if reconciliation ran but that exact
symbol wasn't present in its own comparison set (an edge case — normally
every broker position the Portfolio fetch sees will also appear in
Reconciliation's own independently-fetched position list), or
Matched/Mismatch with the same `detail` sentence the Reconciliation page
itself shows.

### 4.7 Trade History, Performance Analytics & Trading Journal

Three new pages — `/trade-history` ("Trade History"), `/trade-performance`
("Trade Performance" — named distinctly to avoid colliding with the
existing, unrelated options-side "Performance" page at `/performance`), and
an extended existing Trading Journal (via the same `/journal` page and its
own `PATCH /journal/:id` endpoint, unmodified) — together form a historical
review layer over the local `trades` and `journal_entries` tables. **No new
broker endpoint was added or is needed** — the one broker call this layer
makes is `GET /broker/reconciliation`, reused exactly as it already exists
(§4.3), cross-referenced client-side by `tradeId`/`alpacaOrderId`, the same
technique the Paper Portfolio Dashboard (§4.6) already established.

**Trade History is local-data-driven, not broker-driven, so it fetches on
page load like any other list page** (`GET /trades?limit=500`, unmodified —
sorting/filtering/searching/pagination all happen client-side over that one
bounded fetch; a future sprint can add real server-side pagination if trade
volume ever outgrows one call). **Broker reconciliation stays fully
manual** — a "Check Reconciliation" button, never fetched automatically,
matching the discipline every broker-touching page in this app has followed
since the Broker Connection UI sprint.

Two fields Trade History displays are genuine **derivations**, disclosed as
such, never presented as literal broker-reported values:
- **Direction (Long/Short)** — a net-credit trade (`credit >= 0`) is "Short"
  the spread (premium received); a net-debit trade is "Long" it (premium
  paid). A real mapping onto the trade's own already-stored `credit` sign.
- **Exit Price** — no literal exit fill price is stored anywhere on a
  trade, only the realized dollar P&L (`currentPnl`) at close. Since
  `realizedPnl = creditReceivedAtEntry − costToClose`, this platform derives
  `costToClose = credit − currentPnl` once a trade has genuinely closed
  with a known P&L — never fabricated, never shown for an open trade.

`Trade.alpacaOrderId` — stored since the very first sprint that touched
`execution.ts`'s order submission but never previously exposed via the API
— was added to the `Trade` OpenAPI schema this sprint (a purely additive,
backward-compatible field; every existing consumer of `GET /trades`
continues to work unchanged). A `mock-<uuid>`-prefixed id means the trade
was never actually sent to Alpaca (no broker credentials were configured at
submission time) — Trade History labels this "Simulated (no broker order)"
immediately, from local data alone, without waiting for a reconciliation
check to reveal it.

**Performance Analytics is explicitly, unavoidably local-only.** As §4.6
already disclosed for Realized P/L, this platform has no broker-side
realized-P&L source at all — so every single figure on the Trade
Performance page (win rate, average win/loss, largest winner/loser, average
holding time, open/closed counts) is computed by
`lib/tradeAnalytics.ts::computePerformanceAnalytics()`, a pure function over
the same local `trades` array Trade History already fetched, never invented
or approximated from any broker call. The one figure that does touch the
broker layer — **Reconciliation Success Percentage** — is computed by the
same file's `computeReconciliationSuccess()` over
`GET /broker/reconciliation`'s own already-computed `orders[]` (the
percentage of order comparisons with zero issues), honestly `null` ("Not
yet checked") until that manual check has actually been run at least once.

**Trading Journal** gained two new, purely additive, nullable columns —
`thesis` (the case for taking the trade) and `entry_reasoning` (what
specifically triggered entry) — distinct from the pre-existing `content`
(general notes) and `lesson_learned` fields. "Exit Reasoning" needed no new
column at all — it reuses the already-existing `exit_reason` field, simply
relabeled in the UI. **No code change was needed in `routes/journal.ts`
itself** — its `PATCH /journal/:id` handler already does a generic
`db.update(journalEntriesTable).set(parsed.data)`, the same
spread-whatever-the-schema-allows pattern `routes/settings.ts` established
back in Phase 1 — so once the OpenAPI schema allowed the two new fields
through, editing them "just worked." Trade History's own per-trade detail
panel is where a user actually views and edits a trade's linked journal
entries (looked up by `tradeId`, which is a loose, unenforced reference —
the same precedent `journal_entries.trade_id` has followed since Phase 1)
— **not** a duplicate of the existing `/journal` page, which remains
completely untouched and unmodified by this sprint.

**"AI review placeholder" is a static, non-interactive line of text**
("AI-generated trade review is not available yet — coming in a future
sprint") — per the sprint's own explicit "Do not add AI generation yet"
instruction, no LLM call of any kind was added for this.

No database migration beyond the two new nullable journal columns; no
change to `execution.ts`'s order-submission path, `routes/journal.ts`'s
own route logic, or any existing page.

### 4.8 Order Preview & Risk Simulator

A dedicated dry-run page, `/order-preview` ("Order Preview & Risk
Simulator"), lets a user type in a symbol/strategy/quantity and inspect the
full estimated economics of an order — **before, and without ever, actually
placing it.** There is no submit button anywhere on this page; the only
action is "Preview Only."

**Backend: one new, purely additive, read-only endpoint,
`POST /execution/order-preview`** (`lib/orderPreview.ts` +
`routes/orderPreview.ts`, both new files — `execution.ts` itself is
untouched, confirmed via `git diff --stat` at every checkpoint this
sprint). This endpoint is a **composition layer**, not a second execution
engine: it reuses `execution.ts`'s own existing, unmodified
`canonicalQuote()` and `previewOptionOrder()` (itself just an alias for the
same `buildTicket()` the real submit path calls) for every core number —
net credit/debit, max profit, max loss, buying power required, the full
`PreTradeValidation` risk-check list — so the figures shown on this page
are byte-identical to what a real ticket build would compute, proven by a
dedicated regression test (`lib/orderPreview.test.ts`) that cross-checks
this endpoint's output against a direct, standalone call to
`previewOptionOrder()`.

Four fields are genuine, disclosed **derivations** on top of the reused
ticket, never fabricated:
- **Estimated Entry Price** — net credit/debit ÷ quantity (per-spread
  price).
- **Estimated Notional Value** — the standard options-notional formula,
  `Σ (strike × 100 × ratioQty × quantity)` across legs — explicitly
  disclosed as distinct from capital at risk (`maxLoss`), not a synonym
  for it.
- **Estimated Margin Impact** — for these all-defined-risk multi-leg
  spread strategies, margin requirement equals the position's own max
  loss; reused directly, not a separate calculation.
- **Risk/Reward Ratio** — max profit ÷ max loss, honestly `null` (shown as
  "N/A") when max loss is 0.

**The 8-item pre-trade checklist this sprint's scope requested (missing
fields, invalid quantity, invalid symbol, buying power unavailable, broker
disconnected, missing credentials, position conflict, existing open
order)** is a separate, additive layer computed entirely in
`lib/orderPreview.ts` — **not** part of `execution.ts`'s own real
pre-trade risk gate (`validatePreTrade`, completely unmodified and shown
unmodified in the ticket's own `validation` field on this same page). This
distinction is deliberate and disclosed: since this page never submits
anything, none of these 8 items are ever hard-blocking in the sense of
"this order would be rejected" — they are informational, honestly labeled
`ok`/`warning`/`blocked` per item:
- **Missing required fields / Invalid quantity / Invalid symbol** are
  computed from the raw input alone, before any call into `execution.ts` —
  an unresolvable symbol is caught two ways: a cheap ticker-shape regex
  first, then (for a shape-valid but nonexistent symbol) a side-effect-free
  call to `canonicalQuote()`, reused unmodified.
- **Buying power unavailable / Broker disconnected / Missing credentials**
  read already-existing, already-cached state — `readAlpacaCreds()`
  (`lib/providers/alpacaProvider.ts`, unmodified) for credential presence,
  and `getLastBrokerCheckConnected()`/`getLastSuccessfulBrokerCheck()`
  (`lib/providers/alpacaBroker.ts`, unmodified) for the outcome of the most
  recent `GET /broker/health` check — **never a new live broker call**.
  Local account value (from `getAccountValue()`, unmodified,
  `serverState.ts`) is always computable; "buying power" is honestly
  labeled a **local estimate only** unless the most recent Broker Health
  check actually succeeded.
- **Position conflict / Existing open order** are a plain, new, read-only
  `SELECT` against this user's own `trades` rows for the entered symbol
  (`status = 'open'` vs. `status = 'pending'`) — the one genuinely new
  piece of logic this sprint added, and still purely a read.

**Broker connection status on this page is read from the same,
already-existing, manual-only `GET /broker/health` endpoint** — the page's
own "Refresh Broker Health" button, matching the exact `enabled: false` +
explicit-refetch convention every broker-touching page in this app has
followed since the Broker Connection UI sprint. Nothing on this page
auto-triggers a live broker call on mount.

No database migration. No `execution.ts`/`optionsMath.ts`/`risk.ts`
change. No new database write of any kind — every function in
`lib/orderPreview.ts` only ever `SELECT`s.

### 4.9 Position Sizing & Portfolio Impact Calculator

Extends §4.8's Order Preview & Risk Simulator with a full pre-trade
Position Sizing and Portfolio Impact experience, `/position-sizing` — a
new backend composition layer, `lib/positionSizing.ts`, plus one new
endpoint, `POST /execution/position-sizing`. There is still no submit
button anywhere on this page.

**`buildPositionSizingAnalysis()` reuses §4.8's own `buildOrderPreview()`
directly** (unmodified) for the underlying preview ticket, and reuses
`execution.ts`'s own `previewOptionOrder()` a second time (for a 1-lot
reference ticket, used only to back out a recommended quantity — see
below) and `serverState.ts`'s own `computeTradeGreeks()` (the same
function `routes/portfolio.ts`'s Engine 3 dashboard already uses) for
every Greeks figure. `execution.ts`, `optionsMath.ts`, and `risk.ts` are
not modified by this sprint.

**Position Sizing figures**, all either a direct reuse of the ticket's own
already-computed fields or a small, disclosed derivation on top of them:
- **Recommended position size** — the one genuinely new formula this
  sprint: a 1-lot reference ticket for the same symbol/strategy gives the
  per-spread capital at risk, and `floor((accountValue × maxRiskPerTrade%) / oneLotMaxLoss)`
  applies the account's own already-configured per-trade risk cap
  (the exact same setting `execution.ts`'s own `validatePreTrade` already
  enforces) backwards into a suggested quantity — a sizing suggestion, not
  a new risk rule.
- **Position size % of portfolio** / **Concentration before/after trade**
  — direct reuse of the ticket's own `riskPct`/`portfolioRiskBeforePct`/
  `portfolioRiskAfterPct` (already computed by `execution.ts`'s
  `validatePreTrade`, Sprint 4.8's own reuse).
- **Buying power utilization** — `buyingPowerRequired ÷ accountValue`, a
  disclosed percentage derivation.
- **Capital at risk** / **Maximum theoretical loss** — both `= maxLoss`
  (the same figure, matching §4.8's own `marginImpact = maxLoss`
  precedent for these defined-risk spreads).
- **Maximum theoretical gain** — `= maxProfit`, always present for the 4
  supported strategies.
- **Risk/Reward ratio** — reused directly from §4.8's own already-derived
  `riskRewardRatio` field.
- **Break-even price(s)** — a genuinely new, disclosed derivation, but
  built entirely from already-public ticket data (each leg's own
  `side`/`optionType`/`strike`, plus `entryPricePerSpread`): the standard
  credit-spread formula, `shortPutStrike − creditPerShare` (lower) and
  `shortCallStrike + creditPerShare` (upper). **Computed only for iron
  condor / iron fly** — calendar spreads and earnings plays involve
  multiple expirations, so a simple break-even formula would misrepresent
  the real payoff; those honestly report `breakEvens: []` with an explicit
  reason, never an approximated number.

**Portfolio Impact** is always presented as two clearly separate,
independently-labeled sections — **"Current Portfolio"** (the user's real,
already-open `trades` rows, read via a plain `SELECT`, deliberately
**without** calling `ensureSeedTrades()` the way `routes/portfolio.ts`
does, so an empty portfolio is honestly shown as empty rather than
silently auto-seeded — "No portfolio mutation" is taken literally) and
**"Hypothetical Post-Preview Portfolio"** (current positions plus one
synthetic entry reconstructed purely from the already-public
`OrderPreviewTicket`'s own `legs`/`netCredit`/`maxProfit`/`maxLoss` fields
— `OrderLeg.ratioQty × ticket.quantity` reproduces exactly the same
per-trade leg quantity `execution.ts`'s own private `storedLegs` would
have used, all from public data, never a second private call into
`execution.ts` and never persisted anywhere). The hypothetical section is
never rendered as if it were real.

Both sections show: open position count, total capital at risk (dollars
and % of account), **exposure by symbol** (grouped, summed `maxLoss` per
symbol), **long vs. short exposure** (the exact same net-credit-sign
convention §4.7's `tradeDirection()` already established on the frontend
— a net-credit trade is "short" the spread, net-debit is "long" — applied
here on the backend for portfolio aggregation), and portfolio-level
**Greeks** (`computeTradeGreeks()`, unmodified, summed across every
position in the snapshot). **Estimated delta/theta/gamma/vega impact** is
simply `hypothetical.greeks − current.greeks`, honestly `null` whenever no
valid preview exists to build a hypothetical snapshot from.

**Exposure by sector is always honestly reported unavailable** —
`{available: false, reason: "No sector/industry classification is stored
on options positions in this engine."}` — no sector data exists anywhere
on the `trades` table or any Options Income Engine structure, and pulling
one in from Engine 1's own sector taxonomy (`lib/industryPeers.ts`) would
have introduced a cross-engine dependency outside this sprint's explicit
"reuse execution.ts, optionsMath.ts, and previewOptionOrder() calculations
only" instruction. Never fabricated.

**Risk Warnings** (8 categories, all informational — since this page never
submits anything, none of these ever actually block a real order):
- **Oversized position** / **Excess concentration** — direct reuses,
  relabeled, of two of `execution.ts`'s own `validatePreTrade` checks
  ("Max risk per trade ≤ X%" / "Total portfolio risk ≤ Y%") — matched by
  label prefix since the real label is dynamically templated with the
  account's own configured caps. Zero new threshold logic.
- **Buying power exhaustion** — a new, disclosed, named threshold
  (`BUYING_POWER_EXHAUSTION_THRESHOLD_PCT = 90`) on the ticket's own
  already-computed buying-power-utilization percentage.
- **Excess leverage** — a new, disclosed, named threshold
  (`MAX_LEVERAGE_RATIO = 3`) on `notionalValue ÷ accountValue` — reusing
  §4.8's own already-derived `notionalValue`, never a new pricing
  calculation. Both named constants follow the same "state a reasonable
  default, disclose it" precedent as `tradingRisk.ts`'s own 2%/6% caps and
  `investingRisk.ts`'s own 25%/40% concentration caps.
- **Existing position conflict** / **Existing open order conflict** /
  **Missing credentials** — reused directly, unmodified, from §4.8's own
  8-item Order Preview checklist.
- **Missing broker data** — a new, honest disclosure distinct from
  "missing credentials": whenever no successful Broker Health check exists
  this session, every *current-portfolio* figure shown is explicitly
  labeled as sourced from local trade records, not a live Alpaca account.

**Scenario Comparison** — 50%/75%/100% of the entered quantity (rounded,
floored at 1), plus an optional user-supplied "Custom" quantity. Each
scenario is computed by an **independent call to the same reused
`buildOrderPreview()`** with only the quantity varied — genuinely
re-derived, not interpolated or estimated — showing capital at risk,
buying power required/utilization, and concentration-after for each. When
the base symbol/strategy input itself is invalid, the scenario list is
honestly empty rather than computing 4 doomed previews.

No database migration. No `execution.ts`/`optionsMath.ts`/`risk.ts`
change. No new database write of any kind — every function in
`lib/positionSizing.ts` only ever `SELECT`s.

### 4.10 Trade Adjustment & Roll/Convert Preview Simulator

Extends §4.9's Position Sizing & Portfolio Impact Calculator with a
dedicated pre-decision simulator for adjusting an *existing* open
position, `/adjustment-preview` — a new backend composition layer,
`lib/tradeAdjustmentPreview.ts`, plus one new endpoint,
`POST /execution/adjustment/preview-simulator`. There is still no submit
action anywhere on this page.

**Investigation finding that shaped this sprint's whole design:**
`execution.ts`'s `buildAdjustmentTicket()`/`resolveAdjustmentTarget()`
only support exactly 2 real adjustment shapes — "roll" (always re-centers
every strike on the current spot price at a fixed 45-day cycle, no
strike-shift or expiration-only-extend parameter exists) and "convert"
(Iron Condor ↔ Iron Fly tightening/widening only) — and
`buildAdjustmentTicket()` hard-gates on the position's own
`evaluateTradeAdjustment()` recommendation being roll/convert-eligible,
throwing a 409 otherwise. Of the 8 adjustment intents this sprint's spec
requested, only 3 are therefore genuinely computable without writing new
strike-selection logic (explicitly outside this sprint's reuse-only
scope): **Roll Forward** (maps to the real "roll," only works when
roll-eligible), **Convert Position** (maps to the real "convert," only
works when convert-eligible), and **Close & Replace** (a new, small
composition built entirely from already-exported `previewOptionOrder()` +
`computeTradeGreeks()`, which works for *any* open position regardless of
its own adjustment recommendation, since it bypasses
`buildAdjustmentTicket()`'s eligibility gate entirely). The other 5 (Roll
Out, Roll Up, Roll Down, Roll Out & Up, Roll Out & Down) are shown in the
UI picker but **always** honestly report `available: false` with one
consistent, disclosed reason — never fabricated, matching the same
"never fabricate, always disclose gaps" precedent §4.8's sector-exposure
disclosure and §4.9's calendar-spread-break-even disclosure already
established. Full detail: `docs/Trade-Adjustment.md` §2.

**`buildTradeAdjustmentPreview()` reuses, unmodified:**
`buildAdjustmentTicket()` (Roll Forward/Convert), `previewOptionOrder()`
(Close & Replace, reused a second time from §4.8), `evaluateTradeAdjustment()`
(eligibility reads for both the source position and conflict detection),
`computeTradeGreeks()` (Greeks before/after), and §4.9's own
`buildSnapshot()`/`currentOpenTrades()` (portfolio exposure before/after
— both made `export`ed from `lib/positionSizing.ts` this sprint, a
purely additive keyword change, zero logic change to either function).
`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, and
`autoAdjustment.ts` are not modified by this sprint.

**Display fields** — existing position, proposed position,
debit/credit (`netCashflow = proposed.netCredit − existing.costToClose`),
Greeks before/after, break-evens before/after (the same generalized
credit-spread formula §4.9 established, iron condor/iron fly only), and
**6 side-by-side comparisons** (max risk, max reward, buying power
impact, margin impact, risk/reward ratio, concentration), each carrying
an explicit Improved/Worse/Neutral `direction` derived by a small,
disclosed `compareMetric()` function with a `|change| < 0.01` neutral
threshold and an explicit per-metric polarity (e.g. lower max risk is
"improved").

**Portfolio exposure before/after** reuses §4.9's `buildSnapshot()`
twice, but unlike §4.9's own simpler *add* model, this sprint correctly
models *replace* semantics: "after" excludes the source position from the
trade set and adds one synthetic reconstruction of the proposed position
(built from the proposed ticket's own public `legs[]`, the same
`ratioQty × quantity` technique §4.9 established — never a second private
call into `execution.ts`, never persisted).

**Risk Warnings (9 categories)**, all informational since nothing is ever
actually submitted: `missing_position`, `invalid_adjustment` (new — the
requested intent is unavailable or the position isn't eligible for the
requested roll/convert), `buying_power_unavailable`,
`broker_disconnected`, `missing_credentials` (all 3 reused from §4.8's
checklist), `excess_concentration` (reused, relabeled, from
`execution.ts`'s own `validatePreTrade` check, evaluated against the
*after* exposure), `excess_leverage` (a named threshold,
`ADJUSTMENT_LEVERAGE_RATIO = 3`, matching §4.9's own `MAX_LEVERAGE_RATIO`),
`conflicting_order` (new — a pending order already exists for the same
symbol), and `conflicting_adjustment` (new — a *different* open position
in the same symbol also currently has its own roll/convert-eligible
recommendation).

No database migration. No `execution.ts`/`optionsMath.ts`/`risk.ts`/
`autoExecution.ts`/`autoAdjustment.ts` change. No new database write of
any kind — every function in `lib/tradeAdjustmentPreview.ts` only ever
`SELECT`s.

### 4.11 Portfolio Stress Test & Scenario Simulator

Extends §4.9's/§4.10's own reused portfolio-aggregation helpers with a
full What-If simulator, `/stress-test` — a new backend composition
layer, `lib/portfolioStressTest.ts`, plus one new endpoint,
`POST /execution/stress-test`. There is no submit action anywhere on
this page; every result is a hypothetical, in-memory computation over
the user's own current open portfolio.

**The one genuinely new pricing function this sprint introduces,
`computeShockedGreeks()`, is a shock-parameterized sibling of
`serverState.ts`'s own `computeTradeGreeks()` — not a modification of
it.** It reprices every leg of a position at a shocked underlying price
(`snap.price × (1 + priceShockPct/100)`), a shocked implied volatility
(`snap.iv × (1 + ivShockPct/100)`), and a reduced days-to-expiration
(`daysUntil(leg.expiration) − timeDecayDays`) via `optionsMath.ts`'s own
unmodified `bs()` — the identical function `computeTradeGreeks()` already
calls for the unshocked mark. **At `Shock = {0,0,0}` this function is
byte-identical to `computeTradeGreeks()`'s own output**, proven by a
dedicated regression test, not just asserted. `bs()`'s own existing
internal floors (`T` at 1/365, `sigma` at 0.01) handle extreme shocks
honestly without a duplicated ad-hoc clamp; shock inputs are separately
bounded (price -99%..+1000%, IV -99%..+2000%, time decay 0..3650 days)
so a nonsensical input (e.g. a -100% price crash) is never passed
through to `bs()`. `serverState.ts` gained one purely additive change:
its previously-private `daysUntil()` was `export`ed (zero logic change)
for this reuse.

**Portfolio-level aggregation** (`evaluateScenario()`) is called exactly
twice per request path: once with a zero shock (the always-present
`base` field — the real, current, unshocked portfolio) and once per
requested scenario — "before" is never duplicated logic, just the same
function called with `Shock={0,0,0}`. Portfolio value follows
`routes/portfolio.ts`'s own established convention
(`accountValue + Σ(unrealizedPnl)`). Exposure by symbol/strategy is
grouped by shocked mark-to-market value (`costToClose`) — deliberately
genuinely shock-driven, unlike §4.9's own `exposureBySymbol` (maxLoss-
based, intentionally static). Structural risk figures
(`totalRiskDollars`/`totalRiskPct`) reuse §4.9's own already-exported
`buildSnapshot()` unmodified. Sector exposure is always honestly
reported unavailable, the exact same disclosure §4.9 established.

**Buying power impact is honestly always zero, by design, not by
omission**: it reuses `routes/portfolio.ts`'s own
`(accountValue − totalRiskDollars) × 2` formula, and since every
supported strategy is defined-risk, its reserved margin (`maxLoss`) is
fixed at trade open and never moves under a price/IV/time shock — only
the position's mark-to-market value does. This is a real, computed
value whose lack of movement is a disclosed, correct structural property
of defined-risk strategies, proven by a dedicated test.

**Risk score before/after** is the one genuinely new scoring formula
this sprint introduces, following the same "state a reasonable default,
disclose it" precedent as §4.9's `MAX_LEVERAGE_RATIO` and §4.10's
`ADJUSTMENT_LEVERAGE_RATIO`: a 3-component equal-weighted blend
(concentration vs. a new named `RISK_SCORE_CONCENTRATION_CAP_PCT = 25`,
portfolio-risk utilization vs. the user's own already-configured
`settings.maxPortfolioRisk`, and drawdown vs. a new named
`RISK_SCORE_DRAWDOWN_SCALE = 5`), with a hard-cap override
(`RISK_THRESHOLD_BREACH_SCORE_CAP = 60`) whenever any position breaches
the configured per-trade risk threshold — the same hard-cap-override
pattern Engine 1's `investingRisk.ts` and Engine 2's `tradingRisk.ts`
already established for their own portfolio risk scores.

**Risk Analysis** fields: largest losing/gaining position (by shocked
P&L impact), positions breaching `settings.maxRiskPerTrade` (the same
setting `execution.ts`'s own `validatePreTrade` enforces at trade-open
time, reused here as an informational proxy, never a live enforcement
action), concentration changes per symbol, and portfolio drawdown
(`max(0, −portfolioValueImpact ÷ base.portfolioValue × 100)`, honestly
zero for a net-positive scenario).

**Scenario Comparison**: `scenarios` defaults to
`DEFAULT_SCENARIO_PRESETS` (Bullish +5% / Bearish -5% / High Vol +20%
IV / Low Vol -20% IV) whenever the caller omits or empties the field, so
every request returns a useful comparison with zero configuration; a
caller-supplied list combines any mix of price/IV/time-decay shocks per
scenario (support for combining multiple shocks in one scenario is
inherent in the shape of a single scenario, not a separate mode), capped
at 12 scenarios per request (truncated, not rejected, with an honest
`inputIssues` notice).

No database migration. No `execution.ts`/`optionsMath.ts`/`risk.ts`/
`autoExecution.ts`/`autoAdjustment.ts` change. No new database write of
any kind — every function in `lib/portfolioStressTest.ts` only ever
`SELECT`s, and no scenario/shock/comparison is ever persisted.

### 4.12 Earnings & Event Risk Portfolio Overlay

A dedicated, read-only overlay, `/event-risk` — a new backend
composition layer, `lib/portfolioEventRisk.ts`, plus one new endpoint,
`GET /portfolio/event-risk`. There is no submit action anywhere on this
page; every risk-guidance label is purely informational.

**Investigation finding that shaped this sprint's whole design:** this
sprint's own request text lists "FDA decisions" and "product launches" as
example event categories, but no data source for either exists anywhere
in this codebase — `lib/eventRisk.ts`'s own header comment describes
itself as "a deterministic, simulated economic/market event calendar"
covering exactly 7 categories (`earnings`, `dividend`, `fomc`, `cpi`,
`jobs`, `economic`, and the currently-inert `news`). Per this sprint's
own explicit "do not invent new event models" instruction, neither
category is fabricated — the response's own `unsupportedEventCategories`
field discloses this gap directly, and the frontend renders it as its
own always-visible "Event Categories" card. Full detail:
`docs/Portfolio-Event-Risk.md` §2.

**`assessPosition()` reuses `getEventRiskForSymbol()` directly,
unmodified** — the exact same function `execution.ts`/`autoExecution.ts`
already call for their own event-risk gating — for every open position
with a known expiration. **`enabled: true` is deliberately always
passed**, regardless of the user's own `settings.eventRiskEnabled`
toggle: that setting controls whether event risk *blocks* trade
execution/AutoPilot, a different concern from whether this read-only
page is allowed to show real event data; the response's own
`eventRiskEnabled` field surfaces the current setting so the UI can
disclose the distinction without ever gating visibility on it.

**`lib/positionSizing.ts`'s `TradeRow` gained one additive field,
`expiration: string | null`** (populated in `currentOpenTrades()`), since
the shared row shape reused since the Trade Adjustment sprint didn't
previously carry it. The 2 downstream synthetic-`TradeRow`-construction
sites this touched (`positionSizing.ts`'s own `syntheticTradeRow()` and
`tradeAdjustmentPreview.ts`'s own `afterTradeRow`) were updated to
populate it from their own ticket's real `expiration` field — confirmed
behavior-preserving by both files' own pre-existing test suites passing
unmodified.

**Risk Guidance** is a pure, exhaustive label mapping over the existing
`EventRiskLevel` enum (`high`→Consider Adjustment, `medium`→Consider
Review, `low`→Monitor, `none`→No Immediate Event Risk) — zero new risk
scoring, and never wired to any adjustment/order action. **Confidence**
is a disclosed classification of an event's own source shape (market-wide
macro events, generated on a formulaic calendar schedule, are
`"scheduled"`; symbol-specific earnings/dividend events, derived from a
per-symbol seeded estimate, are `"simulated_estimate"`) — not a
fabricated new signal. **Event source is always `"SIMULATED"`** — no live
earnings/dividend/macro-calendar provider exists anywhere in this
codebase.

**Portfolio Summary**: positions with/without events, high-risk count,
countdown buckets (1/3/7/14 days, counting *positions* whose own
soonest event falls within each window — not raw events), aggregate
event exposure (the sum of `portfolioWeightPct`, a genuine % of the
account, across only the positions that carry event risk), and the
highest-risk position (ranked by `EventRiskLevel`, ties broken by the
soonest event, honestly `null` when nothing carries any risk).

**Past events are never fabricated** — `eventRisk.ts`'s own existing
date filters already guarantee every returned event has `daysAway >= 0`
for any caller, proven directly by this sprint's own test suite rather
than merely asserted.

No database migration. No `eventRisk.ts`/`optionsMath.ts`/`execution.ts`/
`risk.ts`/`autoExecution.ts`/`autoAdjustment.ts` change. No new database
write of any kind — every function in `lib/portfolioEventRisk.ts` only
ever `SELECT`s.

### 4.13 Correlation & Concentration Risk Overlay

A dedicated, read-only overlay, `/concentration-risk` — a new backend
composition layer, `lib/portfolioConcentration.ts`, plus one new
endpoint, `GET /portfolio/concentration`. There is no submit action
anywhere on this page; every risk-guidance label is purely
informational.

**Investigation finding that shaped this sprint's whole design:** two
real data gaps exist in this engine and neither is fabricated. **Net
beta** has no data source anywhere — `optionsMath.ts`'s own SIMULATED
`UNIVERSE` carries no beta field for any symbol, so `netBeta` is
**always** `null`, with an explicit `netBetaUnavailableReason` string.
**Sector classification** *does* have a defensible, disclosed source:
Engine 1's own `lib/industryPeers.ts` (Phase 2 Sprint 20) already
established the precedent that a small, hand-curated table of real,
publicly-known sector classifications for a fixed, known symbol set is
categorical metadata, not fabricated financial data — this sprint's own
new `KNOWN_SECTOR_MAP` reuses that exact precedent, assigning the same
coarse sector values Engine 1's own table assigns to the same real
companies (NVDA/AAPL/MSFT → "Technology", GOOGL/META → "Communication
Services", AMZN/TSLA → "Consumer Discretionary", plus dedicated
ETF-fund labels for SPY/QQQ/IWM). Any symbol outside this fixed table
honestly reports `"Unclassified"`, never a guessed classification; the
response's own `sectorDataSource` field (`"KNOWN_UNIVERSE_METADATA"`)
discloses this. Full detail: `docs/Portfolio-Correlation-Concentration.md`
§2.

**Zero new pricing, Greeks, or portfolio-snapshot math.** Every figure
is built directly on `currentOpenTrades()` / `buildSnapshot()`
(`lib/positionSizing.ts`, unmodified) and `computeTradeGreeks()`
(`lib/serverState.ts`, unmodified) — the same primitives every prior
sprint in this family already reuses.

**Concentration weight is deliberately not the same figure as "portfolio
weight."** Earlier sprints (Position Sizing, Stress Test, Event Risk)
express a position's weight as `maxLoss ÷ accountValue × 100` — a share
of account buying power. Concentration bucketing instead needs each
position's share of the portfolio's **own total deployed risk**
(`maxLoss ÷ Σ maxLoss`), computed against `structural.totalRiskDollars`
from the same already-computed `buildSnapshot()` result — the correct
denominator for a Herfindahl-Hirschman-Index-based score. Using the
account-relative figure here would silently understate concentration for
any account that isn't fully deployed.

**Concentration Analysis** covers 7 dimensions (symbol, underlying,
sector, strategy, expiration, asset class, directional bias), each
scored via a standard **Herfindahl-Hirschman Index**
(`Σ(bucket weight fraction)² × 100`) — a disclosed, well-established
statistical convention, not an invented formula. Underlying is
deliberately identical to symbol (every position here is
single-underlying); asset class is always "Equity Option" and is
excluded from the most/least-diversified-area comparison since it's
always 100% concentrated by construction, not a meaningful signal.

**Correlation Overlay is categorical clustering only** — per this
sprint's own explicit "do not invent new correlation models"
instruction, `buildClusters()` groups positions sharing an already-known
trait (same underlying, sector, strategy, expiration, or directional
bias), filtered to groups of 2+ positions. No statistical correlation
coefficient, no external market-correlation data, of any kind.

**Portfolio Summary**: largest concentration, highest directional
exposure, highest Greeks contributor (by `|delta|` share), most/least
diversified area, concentration/diversification scores, and a 4-tier
portfolio health label. **Risk Guidance** is a pure, exhaustive label
mapping (well_diversified/moderate_concentration/high_concentration/
review_exposure on the symbol concentration score, plus an independent
monitor_sector_concentration advisory when the sector score crosses its
own threshold) — zero execution logic, never wired to any
adjustment/order action.

No database migration. No `execution.ts`/`optionsMath.ts`/`risk.ts`/
`autoExecution.ts`/`autoAdjustment.ts`/`eventRisk.ts` change. No new
database write of any kind — every function in
`lib/portfolioConcentration.ts` only ever `SELECT`s.

### 4.14 Portfolio Risk Dashboard & Health Score

A single, dedicated, read-only executive dashboard, `/portfolio-dashboard`
— a new backend composition layer, `lib/portfolioDashboard.ts`, plus one
new endpoint, `GET /portfolio/dashboard`, unifying every prior overlay in
this family (Position Sizing, the Portfolio Stress Test, the Earnings &
Event Risk Portfolio Overlay, the Correlation & Concentration Risk
Overlay) into one Portfolio Health Score. There is no submit action
anywhere on this page; every risk-guidance label is purely informational.

**Portfolio Health Score design discipline:** per this sprint's own
explicit "do not invent statistical models — every component must be
derived from existing calculations" instruction, every one of the 8
requested Health Score factors (Concentration, Diversification, Event
Risk, Net Greeks Exposure, Directional Exposure, Position Sizing
Quality, Number of Positions, Expiration Distribution) is a direct 0-100
health projection of a figure **already computed** by one of the 3
reused overlays — never a new pricing call, never a fabricated
statistic. Only 2 small, disclosed, named threshold constants are
genuinely new (`EVENT_RISK_LEVEL_HEALTH_SCORE`'s label→score table and
`DASHBOARD_HEALTHY_POSITION_COUNT = 5`), the same "state a reasonable
default, disclose it" precedent this codebase has followed since
Position Sizing's own thresholds. The overall Health Score is the
equal-weighted average of all 8 factors; the Overall Risk Rating is a
4-tier banding of that score (healthy/moderate_risk/elevated_risk/
high_risk), matching the Concentration overlay's own 4-tier convention.
Full detail: `docs/Portfolio-Dashboard.md` §2.

**Zero new risk logic — every figure is a direct reuse:** `buildSnapshot()`
supplies Total Risk and Largest Position; `buildPortfolioStressTest({}, userId)`
supplies Portfolio Value/Buying Power and the base-case risk score
(reused directly, unmodified, as the Position Sizing Quality factor);
`buildPortfolioEventRiskOverlay(userId)` supplies Highest Event Risk and
the Event Timeline Summary; `buildPortfolioConcentrationOverlay(userId)`
supplies Net Greeks, Largest Risk Contributor, Highest Concentration,
Highest Directional Exposure, 4 of the 8 Health Score factors, and the
Portfolio Allocation / Concentration Snapshot visualisations — all 4
prior overlay files are completely unmodified by this sprint.

**Guidance reuses, rather than re-derives, existing thresholds**:
"Elevated Concentration" reuses the Concentration overlay's own
`riskGuidance.code`; "Diversification Recommended" reuses its own
already-exported `SECTOR_CONCENTRATION_ADVISORY_THRESHOLD`; "Review Large
Positions" reuses its own already-exported `CONCENTRATION_HIGH_MAX`;
"Elevated Event Risk" reuses the Event Risk overlay's own `highRiskCount`.

**7 dashboard widget cards** each link to their own existing detailed
page (`/position-sizing`, `/stress-test`, `/event-risk`,
`/concentration-risk` ×3, `/settings`) rather than re-implementing that
page's own logic.

**One real concurrency bug caught and fixed during this sprint's own
validation, not anticipated in the pre-code design:** the first draft
fired all 3 reused overlays concurrently via `Promise.all` while also
independently calling `getSettingsRow()` a 4th time itself — since
`getSettingsRow()` (`serverState.ts`, unmodified) is a plain
check-then-insert with no upsert safety, and each of the 3 overlays
already calls it internally, this reliably raced 4 simultaneous
`INSERT`s against the `settings_user_id_unique` constraint for any
brand-new user, reproducing on the very first test run. Fixed entirely
within this sprint's own new `portfolioDashboard.ts` by resolving
`getSettingsRow(userId)` once, alone, before the concurrent fan-out —
`serverState.ts` itself was not touched.

No database migration. No `execution.ts`/`optionsMath.ts`/`risk.ts`/
`autoExecution.ts`/`autoAdjustment.ts`/`eventRisk.ts`/`positionSizing.ts`/
`portfolioStressTest.ts`/`portfolioEventRisk.ts`/`portfolioConcentration.ts`
change. No new database write of any kind — every function in
`lib/portfolioDashboard.ts` only ever `SELECT`s.

### 4.15 Institutional Command Center

The application's primary landing page, mounted at `/` — a single
executive workspace consolidating every existing dashboard in this
platform into 8 sections. **This sprint adds zero new backend routes,
zero new database queries, and zero new calculations of any kind** — it
is a frontend-only composition over already-existing generated hooks,
confirmed by `git diff --stat` showing no new backend files aside from
one small, additive extension (below). Full detail:
`docs/Institutional-Command-Center.md`.

**Not to be confused with the pre-existing `/institutional-dashboard`
page** — an earlier, unrelated sprint's own cross-engine composition for
this platform's stock-research/trading-signal surfaces. The two are
deliberately never merged; `docs/Institutional-Command-Center.md` §2
discloses the naming similarity directly.

**One data source, `useGetPortfolioDashboard()` (Portfolio Risk
Dashboard sprint), satisfies the majority of this page** — its own
`widgets[]`, `guidance[]`, `netGreeks`, allocation buckets, and
credentials/broker disclosure directly populate Sections 1, 2, 4 (Beta),
5, 6, and 7. Section 3 (Options Income Engine) reuses
`useGetPerformanceAnalytics({ period: "all" })`'s own `thetaCollected`
and `useGetThetaIncome()`'s own `monthly` projection — both pre-existing
`pages/Dashboard.tsx`/`pages/TradePerformance.tsx` figures. Section 4's
Delta/Gamma/Theta/Vega reuse `useGetPortfolioGreeks()` directly, the
platform's own original Greeks engine (`pages/Portfolio.tsx`). Section 8
(AI Insights) is deterministic client-side text synthesis over data the
other sections already fetched, plus `useGetTopOpportunities()`'s own
top-ranked candidate (the identical `topPick` derivation
`pages/Dashboard.tsx` already uses) — no LLM call, never an execution
recommendation.

**Wheel Positions, Covered Calls, and Cash Secured Puts are always
honestly disclosed as "Not tracked in this engine," never fabricated as
a zero count** — direct inspection of `execution.ts`'s own `Strategy`
type (`"iron_condor" | "iron_fly" | "calendar_spread" | "earnings"`)
confirmed none of these 3 requested strategy types has ever existed
anywhere in this platform's pricing/scanner/execution logic, the same
"unsupported category, disclosed rather than silently omitted"
precedent the Earnings & Event Risk Portfolio Overlay sprint already
established for FDA decisions and product launches.

**One small, additive backend extension, not a new calculation:**
`lib/portfolioDashboard.ts`'s own `PortfolioDashboardResult` gained
`netBeta`/`netBetaUnavailableReason` fields, populated by directly
assigning the already-received `concentration.netBeta`/
`concentration.netBetaUnavailableReason` (Correlation & Concentration
Overlay, unmodified) — a pure surface-level exposure of an
already-computed value, needed so this page's Greeks Summary section can
honestly disclose Beta's permanent unavailability without a second
network call.

**The Broker section deliberately does not call `GET /broker/health` on
page load** — that endpoint is manual-trigger-only everywhere else in
this codebase, matching this whole project's "no automatic polling"
discipline; this section shows the same cached disclosure fields
`useGetPortfolioDashboard()` already carries, with a link to Settings for
a fresh check.

**Navigation change, the only category of change outside pure
composition this sprint made, explicitly permitted by the sprint's own
"no routing changes outside navigation" instruction:** `App.tsx`'s `/`
route now renders the new `CommandCenter` component; the pre-existing,
completely unmodified `Dashboard` component moved to
`/options-dashboard`. `AppLayout.tsx`'s "Dashboard" nav entry was renamed
"Command Center" (still `href="/"`); a new "Options Dashboard" nav entry
was added immediately after it.

No database migration. No `execution.ts`/`optionsMath.ts`/`risk.ts`/
`autoExecution.ts`/`autoAdjustment.ts`/`eventRisk.ts`/`positionSizing.ts`/
`portfolioStressTest.ts`/`portfolioEventRisk.ts`/`portfolioConcentration.ts`
change. `pages/Dashboard.tsx`, `pages/Portfolio.tsx`,
`pages/PortfolioAI.tsx`, `pages/TradePerformance.tsx`, `pages/Scanner.tsx`
— all zero-line diff.

### 4.16 Institutional Intelligence Engine

A **deterministic** intelligence layer (Phase 8, Sprint 1 — "AI Coach
Foundation") analysing the platform's own already-computed analytics and
producing explainable, fully-traceable observations. **This is NOT an
LLM integration, NOT a chatbot, and NOT a statistical prediction
engine** — every observation is either a direct read of an
already-computed figure or a disclosed, deterministic rule applied to
those figures; no trade recommendation or execution suggestion is ever
generated. Full detail: `docs/Institutional-Intelligence-Engine.md`.

Six services, one orchestrator (`lib/intelligenceEngine.ts`'s
`buildInstitutionalIntelligence(userId)`): the **Observation Engine**
(`lib/intelligenceObservations.ts`, 11 deterministic rules — 4 trend-based
pairs requiring a real prior snapshot, never fabricated when none
exists, plus 7 point-in-time rules), the **Explanation Engine** (a
stable "why did this happen" formatter adding zero new information), the
**Health Engine** (`lib/intelligenceHealth.ts` — "aggregate by
reference," reusing `dash.healthScore`/`dash.overallRiskRating`/
`dash.healthFactors` directly, never a second, competing score), the
**Summary Engine** (`lib/intelligenceSummary.ts` — fixed template
sentences only, never natural-language generation), the **Timeline
Engine** (`lib/intelligenceTimeline.ts` — new/resolved/persistent
observation diffing against the prior day's own recorded snapshot), and
the **Learning Engine** (`lib/intelligenceLearning.ts` — a fixed catalog
mapping each observation category to a real existing page, always ending
with an honestly-disclosed `AI Teacher (coming soon)` entry, never a
fabricated URL). A shared `lib/intelligenceTrend.ts` module holds the one
`computeTrend()` primitive all three trend-aware engines reuse.

**Zero new pricing/risk/portfolio calculations.** Every figure comes
from two already-existing, unmodified sources: `buildPortfolioDashboard()`
(Portfolio Risk Dashboard sprint, §4.14) and the exact same
`currentOpenTrades()` → `computeTradeGreeks()` → `computeThetaIncome()`
composition `routes/portfolio.ts`'s own `GET /portfolio/theta` route
already uses. Scanner/Options Dashboard reuse is deliberately scoped to
Learning Links only, since direct inspection found `GET /scanner/top`
has a real write side-effect (`scanAndPersist()`) this engine must never
trigger.

**One new table, `intelligence_snapshots`** (migration `018`) — the
only new persistent state this sprint introduces, framed explicitly as
history-keeping, not prediction: every persisted column is a snapshot of
an already-computed value, never a forecast. A real DB-level unique
index on `(userId, snapshotDate)` plus `.onConflictDoNothing()` enforces
at most one row per user per calendar day — a deliberately *safer*
pattern than the sequential-`await getSettingsRow()` race workaround the
Portfolio Dashboard sprint needed, since this table has a genuine unique
constraint to lean on. `userId` is `ON DELETE RESTRICT`, matching every
other business table's convention.

**Confidence is derived from source quality and completeness, never
from an AI-style probability** — exactly two bands
(`"high"`/`"moderate"`), each with an explicit `confidenceReason`, per
the sprint's own explicit instruction.

One new read-only endpoint, `GET /intelligence`
(`routes/intelligence.ts`) — the only write it can ever trigger is the
single, at-most-once-per-calendar-day snapshot insert above. One new
frontend page, `pages/InstitutionalIntelligence.tsx`
(`/institutional-intelligence`), carrying **four** permanent indicator
badges ("Institutional Intelligence", "Deterministic Analysis", "Paper
Trading", "Read Only" — every other page in this codebase carries only
2), displaying the Executive Summary, Health Overview, Highest Priority,
Latest Observations, Portfolio/Income/Risk Insights, the Intelligence
Timeline, and Learning Links.

No `execution.ts`/`optionsMath.ts`/`risk.ts`/`autoExecution.ts`/
`autoAdjustment.ts`/`portfolioDashboard.ts`/`portfolioStressTest.ts`/
`portfolioEventRisk.ts`/`portfolioConcentration.ts`/`positionSizing.ts`/
`thetaIncome.ts`/`serverState.ts`/`routes/portfolio.ts`/`routes/scanner.ts`
change. No broker write operations. No portfolio mutation. No LLM call
of any kind.

### 4.17 AI Teacher & Learning Centre

A unified, **deterministic** educational layer (Phase 8, Sprint 2)
consolidating this platform's existing educational functionality (Delta
Masterclass, Greeks Tutor, Trading Quiz, Trade Lessons, Value Investing
School — all reused unchanged) with new content: 7 structured Learning
Paths (47 topics), an 8-entry Strategy Academy, a ~52-term Glossary,
Contextual Explain Mode, Portfolio Learning Mode, 5 deterministic
Interactive Simulations, and unified Learning Progress tracking. Full
detail: `docs/AI-Teacher-Learning-Centre.md`.

**Genuine reuse of the Institutional Intelligence Engine's own
Explanation Engine** (§4.16 above) — `lib/metricExplainer.ts`'s
`explainMetric()` calls `intelligenceObservations.ts`'s own
`explainObservation()` whenever a real, currently-emitted Observation
matches the metric being explained, falling back to a direct read of
the same already-computed dashboard figures otherwise. **Genuine reuse
of `execution.ts`'s own `canonicalQuote()` and `coach.ts`'s own
`positionGreeks()`** — the Strategy Academy's live paper examples (for
the 3 strategies this platform actually builds:
`iron_condor`/`iron_fly`/`calendar_spread`) call the exact same
functions the real Trade Ticket already uses; the other 5 requested
strategies honestly disclose their paper example as unavailable, never
fabricated. **Genuine reuse of `optionsMath.ts`'s own `bs()`** for the
Interactive Simulations' Delta/Theta curves.

**One new table, `learning_progress`** (migration `019`) — the only new
persistent state, and the only new user-state mutation this sprint
introduces: one upserted row per `(userId, itemType, itemKey)`, never a
growing event log. `userId` is `ON DELETE RESTRICT`, matching every
other business table's convention.

**Institutional Intelligence Engine integration (§4.16 above,
updated):** `lib/intelligenceLearning.ts`'s own `AI Teacher (coming
soon)` placeholder is resolved to a real `/learn` link; every
observation category now also links to a real, reused Learning Path
topic and Glossary term where one matches, plus a `/learn?tab=portfolio`
deep link into Portfolio Learning Mode — never a fabricated URL for any
of the three.

One new route file, `routes/learningCentre.ts` (12 routes; one,
`GET /learning-centre/explain/:metric`, is deliberately kept **outside**
the OpenAPI/orval contract for the same path+query-parameter Orval
codegen collision reason first disclosed at Sprint 40). One new frontend
hub, `pages/learn/LearningCentre.tsx` (`/learn`), plus
`pages/learn/LearningPaths.tsx`, `pages/learn/StrategyAcademy.tsx`,
`pages/learn/Glossary.tsx`, and a reusable
`src/components/learn/ExplainButton.tsx` widget wired onto the Portfolio
Dashboard, Portfolio (Greeks), and Trades pages.

No `execution.ts`/`optionsMath.ts`/`risk.ts`/`autoExecution.ts`/
`autoAdjustment.ts`/`portfolioDashboard.ts`/`intelligenceObservations.ts`/
`intelligenceHealth.ts`/`intelligenceSummary.ts`/`intelligenceTimeline.ts`/
`intelligenceEngine.ts` change. No broker write operations. No
portfolio or trade mutation of any kind (Learning Progress is the sole,
disclosed exception). No LLM call of any kind. The platform remains
**Paper Trading only** throughout.

### 4.18 AI Portfolio Analyst

The **executive portfolio briefing layer** (Phase 8, Sprint 3) —
`lib/intelligenceEngine.ts`'s own header comment already named it as a
future consumer. **PURE COMPOSITION, zero new pricing/risk/scoring
calculations.** `lib/portfolioAnalyst.ts`'s `buildPortfolioAnalyst(userId)`
assembles the Institutional Intelligence Engine's own Executive Summary/
Health/Timeline output (§4.16), `buildPortfolioDashboard()` (§4.14),
`buildPortfolioEventRiskOverlay()` (§4.12), and the exact same
`currentOpenTrades()` → `computeTradeGreeks()` → `computeThetaIncome()`
composition already reused twice (`routes/portfolio.ts`'s own theta
route and `intelligenceEngine.ts`'s own private helper) into 11 sections:
Executive Daily Briefing, Portfolio Snapshot, Health Summary, Risk
Summary, Income Summary, Performance Summary, Greeks Summary, Event
Summary, Learning Summary, Portfolio Timeline, and Institutional
Insights. **This is NOT an LLM, a chatbot, predictive AI, financial
advice, or a trade-recommendation engine.** Full detail:
`docs/AI-Portfolio-Analyst.md`.

**A genuine, disclosed fix inside this sprint's own new code, not a
change to any protected or pre-existing file:** `buildPortfolioAnalyst()`'s
top-level assembly calls its 5 sub-builders **sequentially, not via
`Promise.all`** — several independently resolve the same per-user
settings row via `serverState.ts`'s own pre-existing, unmodified
`getSettingsRow()` (a plain check-then-insert, not an upsert), and for a
genuinely brand-new user firing them concurrently races two inserts
against the same unique constraint (the same pre-existing race category
first disclosed at Sprint 70, rediscovered by this sprint's own test
suite). A sequential `await` inside this module's own assembly function
avoids the race entirely; `getSettingsRow()` itself was not touched.

**One new, minimal, read-only rollup:** `buildWeeklySummary()` — a plain
`SELECT` + array min/max over the last 7 calendar days of the caller's
own already-persisted `intelligence_snapshots` rows (no new table, no
new column), honestly reporting `insufficient_history` when fewer than 2
rows exist in the window.

**Performance Summary's own disclosed engine boundary:** unlike this
sprint's other 9 sections (all real Paper Trading data), the sprint's
requested Return/Drawdown/Win Rate/Expectancy/Average Winner/Average
Loser/Portfolio Growth fields map onto the pre-existing, entirely
**SIMULATED** Performance Analytics engine (`lib/performanceAnalytics.ts`,
§4.9) — fetched independently on the frontend via the pre-existing
`useGetPerformanceAnalytics()` hook (mirroring `CommandCenter.tsx`'s own
multi-engine composition pattern) and explicitly labeled "SIMULATED" in
the UI, never blended with or presented as this account's own real trade
history. Net Liquidation/Daily P/L are real (independently fetched via
the pre-existing `useGetPortfolioSummary()` hook, §4.5's own route),
since `routes/portfolio.ts`'s inline arithmetic was never extracted into
a reusable function.

One new read-only endpoint, `GET /portfolio-analyst`
(`routes/portfolioAnalyst.ts`) — the only write it can ever trigger is
the same, already-existing, at-most-once-per-calendar-day
`intelligence_snapshots` insert §4.16 already documents. `openapi.yaml`
gained 13 new `Analyst`-prefixed schemas (the `Analyst` prefix
deliberately avoids colliding with the pre-existing, unrelated
`PortfolioSnapshot` schema from §4.9 — the same collision-avoidance
discipline first established at Phase 2 Sprint 28). One new frontend
page, `pages/PortfolioAnalyst.tsx` (`/portfolio-analyst`), carrying
**five** permanent indicator badges ("AI Portfolio Analyst",
"Institutional Intelligence", "Deterministic Analysis", "Paper Trading",
"Read Only").

No `execution.ts`/`optionsMath.ts`/`risk.ts`/`autoExecution.ts`/
`autoAdjustment.ts`/`portfolioStressTest.ts`/`portfolioDashboard.ts`
(the 7 files explicitly protected for this sprint) change, nor do
`intelligenceEngine.ts`/`intelligenceObservations.ts`/
`intelligenceHealth.ts`/`intelligenceSummary.ts`/
`intelligenceTimeline.ts`/`intelligenceLearning.ts`/
`portfolioEventRisk.ts`/`positionSizing.ts`/`serverState.ts`/
`thetaIncome.ts`/`performanceAnalytics.ts`/`routes/portfolio.ts`. No
broker write operations. No portfolio mutation of any kind. No LLM call
of any kind. The platform remains **Paper Trading only** throughout.

### 4.19 AI Trade Journal

A **deterministic behavioural analysis and trade review system**
(Phase 8, Sprint 4) analysing every completed Paper Trading trade using
this platform's own existing analytics. **This is NOT a chatbot, NOT an
AI trading signal engine, NOT financial advice, and NOT portfolio
management** — every score/pattern is deterministic and traceable to an
existing calculation or a real, stored trade field, never a subjective
AI judgement. Full detail: `docs/AI-Trade-Journal.md`.

`lib/tradeJournal.ts`'s `buildTradeJournal(userId)` composes: a
**Trade Review** per closed trade (strategy, holding period, P/L, Risk
Taken/Reward Achieved, position size, and — the one genuinely new piece
of derivation this sprint adds — Greeks at Entry/Exit and Event Risk at
Entry, both computed at a real historical date rather than "now"); a
**Decision Quality** score per trade (10 deterministic tags, each
citing a real rule reference — `settings.maxRiskPerTrade`,
`settings.profitTarget75`, `risk.ts`'s own `computeStopLoss()`, or the
trade's own real `exitReason`); cross-trade **Behaviour Analysis** (8
repeatable patterns — Over-Sizing, Stable Position Sizing, Consistent
Discipline, Excessive Concentration, Strong Diversification, Frequent
Early Exits, Holding Losing Trades Too Long, Repeated Earnings Exposure
— each naming its own real trade count/ratio, none surfaced before at
least 3 closed trades exist); a **Discipline Score** and a **Behaviour
Trend** (reusing the shared `computeTrend()` primitive exactly as every
other engine in this codebase already does); **Learning
Recommendations** (education only — real Learning Centre lesson/
Glossary term/Strategy Academy links, never a trade recommendation);
and a **Journal Timeline** (real `trade_opened`/`trade_closed`/
`learning_completed`/`behaviour_change` events, every one carrying a
genuinely stored timestamp — never a fabricated event).

**Three small, disclosed helpers, each a trivial generalization of an
existing formula — never a new pricing/risk model:**
`computeGreeksAsOf()` (the exact `bs()`/leg-sign/multiplier formula
`serverState.ts`'s own `computeTradeGreeks()` already uses, generalized
to accept a historical date since `getSnapshot(symbol, dateStr)` already
supports one), `deriveLotQuantity()` (mirrors
`portfolioEventRisk.ts`'s own private, unexported formula, reimplemented
locally since that file is out of scope for modification this sprint),
and `tradeHoldingPeriodDays()` (mirrors
`tradeAnalytics.ts`'s own frontend formula, necessarily reimplemented
backend-side since this codebase has no frontend/backend shared-logic
layer). **Event Risk at Entry is a genuine historical reconstruction,
not an approximation:** `getEventRiskForSymbol()` already accepts a
`now` override (the exact function `execution.ts`/`autoExecution.ts`/
`portfolioEventRisk.ts` already call for live gating) — passing
`now = trade.openDate.getTime()` deterministically reproduces what the
same gate would have reported at entry.

**A genuine, disclosed data-availability gap, honestly handled:**
per-trade "Maximum Drawdown" is not included — no intraday/daily P&L
history is persisted per trade anywhere in this codebase, and
fabricating a curve from only the two known points (entry, exit) would
not be a real drawdown.

Two new read-only endpoints: `GET /trade-journal` (the full result) and
`GET /trade-journal/{tradeId}` (a single Trade Review, 404 for a trade
that doesn't exist, isn't the caller's own, or isn't yet closed).
Neither can ever trigger a write of any kind. `openapi.yaml` gained 10
new `Journal`-prefixed schemas (avoiding any collision with the
pre-existing, unrelated `JournalEntry` schemas) plus both paths;
`JournalEventRiskAtEntry.events` directly `$ref`s the already-existing
`EventRiskEvent` schema. One new frontend page,
`pages/TradeJournal.tsx` (`/trade-journal-ai`), carrying **five**
permanent indicator badges ("AI Trade Journal", "Behaviour Analysis",
"Deterministic Review", "Paper Trading", "Educational Only").

**Reuses, never duplicates, the pre-existing free-text Trading
Journal** (`journal_entries`, §4.7) — every Trade Review surfaces that
trade's own already-existing linked entry (the one `tradeClose.ts`'s
own `closeTradePosition()` already auto-writes on every real close)
read-only; this sprint performs zero new journal writes.

No `execution.ts`/`optionsMath.ts`/`risk.ts`/`autoExecution.ts`/
`autoAdjustment.ts`/`portfolioDashboard.ts`/`portfolioStressTest.ts`
(the 7 files explicitly protected for this sprint) change, nor do
`portfolioEventRisk.ts`/`positionSizing.ts`/`thetaIncome.ts`/
`serverState.ts`/`eventRisk.ts`/`intelligenceTrend.ts`/
`intelligenceLearning.ts`/`learningPaths.ts`/`glossary.ts`/
`strategyAcademy.ts`/`learningProgress.ts`/`routes/journal.ts`/
`lib/tradeClose.ts`/`lib/portfolioAnalyst.ts`. No broker write
operations. No portfolio mutation of any kind. No new journal write of
any kind. No LLM call of any kind. The platform remains **Paper Trading
only** throughout.

### 4.20 Institutional Mentor

The **final intelligence layer** (Phase 8, Sprint 5): teaches the user
how a professional portfolio manager would evaluate their own existing
Paper Trading portfolio, using the exact same platform data every other
engine already computes. **This is NOT a chatbot, NOT an AI trading
signal engine, NOT financial advice, NOT portfolio optimisation, and
NOT execution logic** — every score/observation/review sentence is
deterministic and fully traceable. Full detail: `docs/Institutional-Mentor.md`.

`lib/institutionalMentor.ts`'s `buildInstitutionalMentor(userId)`
composes: a **Portfolio Scorecard** (9 categories — Capital Allocation,
Risk Management, Diversification, Discipline, Income Generation,
Position Sizing, Greeks Management, Event Preparation, Portfolio
Health — each score a direct projection of an already-computed figure
off `buildPortfolioDashboard()`/`buildPortfolioConcentrationOverlay()`/
`buildPortfolioStressTest()`/`buildTradeJournal()`, cited by a real
`sourceModule` string); a **Professional Review** (fixed-template
institutional-PM-voice observations, e.g. "An institutional portfolio
manager would note that Technology exposure represents 41% of total
allocation.", gated by already-computed thresholds and a genuine 7-day
Diversification trend); a **Decision Review** (e.g. "Position sizing
followed plan.", "Risk allocation exceeded policy on the current
portfolio.", each citing a real rule reference); and narrative
**Capital Allocation / Risk / Income / Behaviour Reviews** — the last a
direct pass-through of the AI Trade Journal's (§4.19) own already-
computed `disciplineScore`/`decisionQualitySummary`/`behaviorPatterns`/
`behaviorTrend`.

**One small, disclosed, named threshold set — the sole genuinely new
figure this sprint introduces:** `INCOME_POSITIVE_THETA_BASE_SCORE`/
`INCOME_ZERO_THETA_BASE_SCORE`/`INCOME_NEGATIVE_THETA_BASE_SCORE`/
`INCOME_TREND_ADJUSTMENT` band Income Generation's 0-100 score, since no
existing 0-100 income score exists anywhere else in this codebase to
project directly. **A genuine, real 7-day trend**, mirroring
`portfolioAnalyst.ts`'s own `buildWeeklySummary()` precedent: a plain
`SELECT` over `intelligence_snapshots`' own already-stored
`diversificationScore` column, then `computeTrend()` between the oldest
and newest recorded value — no new statistical model.

One new read-only endpoint: `GET /institutional-mentor` (the full
result). **Unlike the AI Portfolio Analyst, this route never triggers a
database write of any kind** — it never calls
`buildInstitutionalIntelligence()`, confirmed by a dedicated test that
`intelligence_snapshots` gains zero rows across repeated calls.
`openapi.yaml` gained 12 new `Mentor`-prefixed schemas (avoiding any
collision with the pre-existing `Analyst`/`Journal`-prefixed schemas
from the same Phase 8 sprint family) plus the path; existing
`ThetaBreakdown`/`HighestRiskPosition`/`ConcentrationBucket`/
`DashboardGuidanceAdvisory`/`JournalDecisionQualitySummary`/
`JournalBehaviorPattern`/`JournalBehaviorTrend` schemas are all reused
via `$ref` rather than redefined. One new frontend page,
`pages/InstitutionalMentor.tsx` (`/institutional-mentor`), carrying
**five** permanent indicator badges ("Institutional Mentor",
"Professional Portfolio Review", "Deterministic Analysis", "Paper
Trading", "Educational Only").

**Institutional Lessons** mirrors `portfolioAnalyst.ts`'s own
`crossLinkFor()` pattern exactly — reusing `intelligenceLearning.ts`'s
own catalog, which already appends "Your Portfolio, Explained" (Explain
Mode's own contextual portfolio-explanation view) and the AI Teacher
entry point to every category — the literal "Related Learning Centre
lesson, Strategy Academy page, Glossary terms, Explain Mode"
requirement, never a fabricated URL.

No `execution.ts`/`optionsMath.ts`/`risk.ts`/`autoExecution.ts`/
`autoAdjustment.ts`/`portfolioDashboard.ts`/`portfolioStressTest.ts`
(the 7 files explicitly protected for this sprint) change, nor do
`portfolioConcentration.ts`/`positionSizing.ts`/`thetaIncome.ts`/
`serverState.ts`/`intelligenceTrend.ts`/`intelligenceLearning.ts`/
`learningPaths.ts`/`glossary.ts`/`strategyAcademy.ts`/`tradeJournal.ts`/
`lib/portfolioAnalyst.ts`. No broker write operations. No portfolio
mutation of any kind. No write to `intelligence_snapshots`. No LLM call
of any kind. No trade prediction or recommendation of any kind. The
platform remains **Paper Trading only** throughout.

## 5. What remains deferred

- **Real Alpaca Paper account credentials.** The single blocking item for
  turning every "not verified live" disclosure in this document, in
  `docs/Broker-Health-API.md`, and in `CLAUDE.md`'s own Sprint 62/75/76
  entries into a real, live-verified statement.
- **Real multi-leg (`mleg`) order response verification** — specifically,
  whether Alpaca's real parent-order `symbol` field for an `mleg` order
  matches this reconciliation's own assumed convention (§4.3's
  symbol-comparison caveat). This can only be settled by observing a real
  response.
- **Pagination for `GET /v2/orders?status=all`** — bounded to Alpaca's own
  default page size this sprint; an account with a very long order history
  would need a follow-up sprint to page through it.
- **Realized P/L.** No provider method exists anywhere in this codebase for
  Alpaca's portfolio-history or account-activities endpoints, the only
  sources for a real realized profit/loss figure — the Paper Portfolio
  Dashboard (§4.6) always shows "Not available" for this field, honestly,
  rather than estimating it from the data this platform does fetch.
- **Any automatic correction, cancellation, or position-closing action.**
  Explicitly and permanently out of scope for this reconciliation layer by
  design — it is a read-only comparison tool, not a repair tool. If a future
  sprint ever considers adding write-side reconciliation actions (e.g. "sync
  local trade status from broker"), that is a new, separately-scoped,
  separately-approved decision, not an extension of this one — see CLAUDE.md
  rule 1 (never modify execution logic without explicit, specific approval).

## 6. Non-negotiable invariants (restated, not new)

Every rule in `CLAUDE.md` §2 applies to this integration exactly as it does
to everything else in this codebase. Specifically for this document's scope:

1. `execution.ts`/`optionsMath.ts`/`risk.ts` are never modified by any of
   the read-only work described here.
2. There is no live-trading endpoint anywhere in this codebase — verified
   directly, not assumed, at the close of every sprint.
3. Reconciliation never writes to the local database beyond its own
   `SELECT` — no automatic correction of any kind.
4. No secret value (`ALPACA_API_SECRET`, or any resolved API key) is ever
   logged, cached, or returned in any response body across any of the three
   layers.

## 7. Test inventory (all sprints, credential-free)

| Layer | Coverage |
|---|---|
| `alpacaOrderLifecycle.ts` | Pure-function unit tests — every raw→normalized mapping, case-insensitivity, the honest-unknown-fallback path, and every `isStatusContradiction()` rule (including the "never guess when either side is unknown" proof). |
| `alpacaBroker.ts` (orders/positions additions) | Mocked-fetch unit tests for `getAlpacaOrder`/`getAlpacaAllOrders`/`getAlpacaPosition` — success, `no_credentials`, `unauthorized`, `http_error`, `network_error` for each, plus the 404-as-honest-null proof for `getAlpacaPosition` specifically (distinguished from `getAlpacaOrder`'s 404-as-`http_error` behavior). |
| `brokerReconciliation.ts` | Unit tests against a real, isolated test-database user (never the shared legacy-owner account) — every issue type (`missing_at_broker`, `missing_locally`, `status_mismatch`, `quantity_mismatch`, `symbol_mismatch`), filled-order/partially-filled/rejected/cancelled/unknown broker statuses, the mock-order-id exclusion, the closed-trade exclusion, position-mismatch scenarios (missing at broker, missing locally, quantity mismatch), the "only open trades contribute a position" rule, and a genuine fully-reconciled (`issueCount: 0`) scenario. |
| `routes/brokerReconciliation.ts` | Live end-to-end HTTP tests against the real app — the real, live "no credentials" state for all 4 routes (including `/broker/positions`, this environment's actual state, unmocked), plus mocked-network success/empty-list/auth-failure/network-failure branches for each. |
| `PaperTradingReconciliation.tsx` | Frontend smoke tests — loading, a genuine request-level error, the honest no-credentials/auth-failure/network-failure states with the page remaining usable, a fully-reconciled render, every issue-type render, filled/partially-filled/rejected/cancelled/unknown order status rendering, position-mismatch and matched-position rendering, and the Refresh button's loading/disabled/click-triggers-refetch behavior. |
| `PaperPortfolio.tsx` | Frontend smoke tests — the always-visible Paper Trading Mode badge, the honest "not yet checked" state for all 3 sections before any refresh (proving nothing auto-fetches), Realized P/L's permanent "Not available" disclosure, empty-portfolio and populated-portfolio (long and short) rendering with a real summed Unrealized P/L, no-credentials/auth-failure/network-failure for each of the 3 independent sections, position-card reconciliation cross-referencing (not-yet-checked/matched/mismatch), and each Refresh button's independent loading/disabled/click-triggers-only-its-own-refetch behavior. |
| `lib/tradeAnalytics.ts` | Pure-function unit tests — direction/exit-price/holding-period/spread-quantity derivation (including the honest-null paths for an unclosed trade or a trade with unknown P&L), `isMockOrderId`'s classification, `computePerformanceAnalytics()`'s win rate/averages/largest winner-loser/breakeven-exclusion/open-vs-closed counting over a real mixed trade set, and `computeReconciliationSuccess()`'s honest-null-before-checked path and its real-percentage computation over constructed `OrderReconciliationEntry` fixtures. |
| `TradeHistory.tsx` | Frontend smoke tests — loading/error/honest-empty states, a populated row's direction/exit-price/status/holding-period rendering, search-by-symbol, status filtering, strategy filtering, symbol sorting (both directions), pagination across multiple pages, the honest "Simulated (no broker order)" label for a mock-originated trade (independent of whether reconciliation has ever run), the "Not yet checked" vs. Matched vs. Mismatch reconciliation badge progression, the Check Reconciliation button's disabled/click-triggers-refetch behavior, linked journal entries rendering and editing (a real `PATCH /journal/:id` payload proof), the honest "no journal entries" message, and the static AI review placeholder. |
| `TradePerformance.tsx` | Frontend smoke tests — the always-visible Paper Trading Mode badge and local-data-only disclosure, loading/error/honest-empty states, every one of the 11 analytics cards computed from real local trade data, the reconciliation success percentage's honest-not-yet-checked/real-percentage/unavailable-reason states, and the Check Reconciliation button's disabled/click-triggers-refetch behavior. |
| `lib/orderPreview.ts` | Unit tests against an isolated, fresh test user — the honest-missing-fields/invalid-quantity/invalid-symbol/invalid-strategy paths, a byte-identical-to-`previewOptionOrder()` proof for a valid preview, the 4 derived fields' own formulas, the honest no-credentials/no-broker-check states, the local-estimate-only buying-power disclosure, position-conflict and existing-open-order detection scoped strictly to the calling user (including the closed-trade-doesn't-count proof), and a never-mutates-the-trades-table proof. |
| `routes/orderPreview.route.test.ts` | Live end-to-end HTTP tests against the real app — well-shaped honest-unavailable responses for missing fields/invalid quantity/invalid symbol, a well-shaped successful preview (including that the response never carries an `orderId`/`tradeId`/`journalId`-shaped field), determinism across repeated identical calls, the honest no-credentials state, the real disconnected-broker state (via a genuine `GET /broker/health` round trip in this credential-free environment), and a 400 for a genuinely malformed request body. |
| `OrderPreview.tsx` | Frontend smoke tests — the always-visible Paper Trading Mode badge and "no order will be submitted" notice, the empty-preview state before any request, the submitted-payload proof for symbol/strategy/quantity, loading and error states, honest validation-error rendering (missing fields/invalid symbol/invalid quantity), a full successful-preview render across every requested field, the missing-credentials/broker-disconnected/buying-power-unavailable/position-conflict/existing-order checklist warnings, and the Broker Connection Status card's independent not-yet-checked/checked states and its own Refresh button. |
| `lib/positionSizing.ts` | Unit tests against isolated, fresh test users — an empty-portfolio proof (zero current exposure, no crash), a hypothetical-snapshot-with-one-synthetic-position proof for an empty starting portfolio, multi-position exposure-by-symbol grouping and long/short classification against 3 constructed trades, real portfolio-level Greeks (proving `computeTradeGreeks()` is genuinely called, not a placeholder), the always-unavailable sector-exposure disclosure, all 8 risk-warning categories including the reused-`validatePreTrade`-check proofs for oversized-position/excess-concentration, the named buying-power-exhaustion/excess-leverage thresholds, position-conflict detection, the missing-credentials/missing-broker-data disclosures, the 2-break-even-bracketing-short-strikes proof for iron condor, the honest break-even-unavailable path for calendar spreads, direct-reuse proofs (capital-at-risk/max-loss/max-gain/risk-reward/concentration all equal the ticket's own fields, never a second calculation), the recommended-quantity derivation, 50%/75%/100% scenario scaling with monotonic capital-at-risk, the optional Custom scenario, the honest-empty-scenario-list path for an invalid base symbol, and a never-mutates-the-trades-table proof. |
| `routes/positionSizing.route.test.ts` | Live end-to-end HTTP tests against the real app — a well-shaped successful analysis, the honest-unavailable-preview/empty-scenarios/still-computed-current-portfolio path for an invalid symbol, the presence of every one of the 8 risk-warning categories, the Custom-scenario wiring, determinism across repeated identical calls, a 400 for a genuinely malformed request body, and the never-a-broker-write-surface proof. |
| `PositionSizing.tsx` | Frontend smoke tests — the always-visible Paper Trading Mode and Preview Only badges, the submitted-payload proof for symbol/strategy/quantity/customQuantity, loading and error states, honest validation-error rendering, the full Position Sizing card (all 9 requested fields plus break-evens), the honest break-even-unavailable message, the honest empty-current-portfolio message, multi-position exposure-by-symbol rendering, the clearly-labeled current-vs-hypothetical section distinction, the estimated delta/theta/gamma/vega impact display, the always-honest sector-exposure disclosure, oversized-position/excess-concentration/buying-power-exhaustion blocked-warning rendering, missing-credentials/missing-broker-data warning rendering, the 50%/75%/100% scenario table, the optional 4th Custom scenario row, an honest unavailable-scenario message, and the scenario table's own absence when the base preview is unavailable. |
| `lib/tradeAdjustmentPreview.ts` | Unit tests against isolated, fresh test users, using empirically-verified real `buildIronCondor()` quotes (never fabricated financials, which would trigger spurious stop-loss-breach recommendations) — input validation, a full Roll Forward scenario for a real roll-eligible position (including the 5 always-unavailable strike-shift intents proven via `it.each`), a Convert Position scenario for a real convert-eligible position, 2 Close & Replace scenarios (including a position with no adjustment recommendation at all, proving the eligibility-gate bypass), 7 invalid-adjustment paths, missing-credentials/broker-disconnected warnings, concentration/leverage warnings, and existing conflicting-order/conflicting-adjustment detection. |
| `routes/tradeAdjustmentPreview.route.test.ts` | Live end-to-end HTTP tests against the real app — honest missing-field/missing-position responses, a well-shaped successful Close & Replace preview against a real, self-inserted position (including that the response never carries an `orderId`/`tradeId`/`journalId`-shaped field), all 5 strike-shift intents' consistent unavailable reason, determinism across repeated identical calls, a 400 for a genuinely malformed request body, and a 400 for an invalid intent enum value. |
| `TradeAdjustmentPreview.tsx` | Frontend smoke tests — the always-visible Paper Trading Mode and "Preview Only — No adjustment will be submitted" badges, the honest empty-positions message, the submitted-payload proof for tradeId/intent/quantity, loading and error states, honest validation-error rendering, the invalid-adjustment message for an unavailable intent, full Roll Forward/Convert Position/Close & Replace comparison rendering, Greeks before/after display, the honest break-even-unavailable message, portfolio exposure before/after, all 6 comparison direction badges (including a "worse" case), excess-concentration/buying-power-unavailable/missing-credentials warning rendering, and the Broker Connection Status card's not-yet-checked/disconnected states with its own independent Refresh button. |
| `lib/portfolioStressTest.ts` | Unit tests against isolated, fresh test users, using real `buildIronCondor()`/`buildCalendar()` quotes — an empty-portfolio proof (zeroed-out base and scenarios, no crash), the zero-shock byte-identical-to-`computeTradeGreeks()` regression proof, a never-mutates-the-trades-table proof, single/multiple-position exposure-by-symbol/by-strategy grouping, largest losing/gaining position detection, concentration-changes coverage, combined price+IV shocks producing genuinely different results than either alone, all 4 requested time-decay presets, extreme scenarios (huge crash/melt-up, expiration-exceeding time decay) staying finite via clamping, honest input-issue flags for a no-op scenario and a too-many-scenarios request, risk-threshold-breach detection and the risk-score hard-cap override, the honestly-always-zero buying-power-impact proof, scenario-comparison independence and labeling, drawdown honesty (zero for a net-positive scenario), and determinism. |
| `routes/portfolioStressTest.route.test.ts` | Live end-to-end HTTP tests against the real app — a well-shaped default-presets response for an empty request body, custom combined-shock scenarios, honest field presence regardless of portfolio state, the never-a-broker-write-surface proof, honest credentials/broker-connection disclosure, a 400 for a genuinely malformed request body, and determinism across repeated identical calls. |
| `PortfolioStressTest.tsx` | Frontend smoke tests — the always-visible Paper Trading Mode and "Simulation Only — No broker interaction occurs" badges, adding a quick preset scenario to the queue, building and adding a custom combined-shock scenario, removing a queued scenario, the submitted-payload proof for both the empty-queue (server-defaults) and populated-queue cases, loading and error states, honest input-issue notices, the base-case portfolio value/P/L/buying-power/risk-score/Greeks display, the honest empty-portfolio exposure message, the always-visible sector-exposure disclosure, one comparison card per requested scenario with its own shock/P&L-impact/risk-score, largest gaining/losing position and threshold-breach warning display, the honest no-breaches message, drawdown display (None vs. a percentage), and concentration-change display. |
| `lib/portfolioEventRisk.ts` | Unit tests against isolated, fresh test users, using empirically-verified real symbol/expiration combinations (never guessed) — an empty-portfolio proof (zeroed-out summary, no crash), the honest unsupported-event-category disclosure, an event-free position (short expiration, non-dividend symbol), multiple positions with multiple distinct event categories (earnings + economic + jobs + cpi) on one position, events sorted soonest-first with a proven-correct primary-event selection, high-risk earnings-bearing positions with Consider Adjustment guidance, the highest-risk-position summary derivation, aggregate-exposure-only-counts-at-risk-positions proof, medium-risk macro-only positions with Consider Review guidance and "scheduled" confidence, low-risk dividend-only positions with Monitor guidance and "simulated_estimate" confidence, countdown-bucket (1/3/7/14 day) position counting, a never-fabricates-a-past-event proof for an already-expired position, honest degradation for a symbol with no known earnings snapshot, honest `expiration_unknown` handling for a defensively-malformed open trade with no expiration on record, quantity/portfolio-weight derivation, the always-SIMULATED event-source disclosure, determinism, and a never-mutates-the-trades-table proof. |
| `routes/portfolioEventRisk.route.test.ts` | Live end-to-end HTTP tests against the real app — a well-shaped result with a real summary and honest unsupported-category disclosure, every position carrying a well-shaped assessment with non-past events, honest credentials/broker-connection disclosure, the `eventRiskEnabled` setting surfaced, the never-a-broker-write-surface proof, GET-only/no-request-body behavior, and determinism across repeated calls. |
| `PortfolioEventRisk.tsx` | Frontend smoke tests — the always-visible Paper Trading Mode and "Read-Only Event Risk Analysis" badges, loading and error states, the honest empty-portfolio message, the honest no-events-position message, multiple positions with multiple event categories rendering together, high-risk Consider Adjustment guidance and highest-risk-position summary, countdown-bucket and aggregate-exposure display, the always-visible unsupported-category (FDA decisions, product launches) disclosure, filtering by event status, filtering by risk level, an honest no-matches-filtered message, sorting by portfolio weight, and the Broker Connection Status card's not-yet-checked state with its own independent Refresh button. |
| `lib/portfolioConcentration.ts` | Unit tests against isolated, fresh test users — an empty-portfolio proof (zeroed-out figures across all 7 dimensions, always-unavailable net beta, no crash), single-position 100%-concentration across every dimension including the underlying===symbol equality proof, balanced multi-symbol portfolios, high-concentration scenarios (4 same-symbol positions) with `review_exposure` guidance and genuine clusters, multiple-sector and multiple-strategy and multiple-expiration breakdowns (including shared-expiration clustering), the honest `"Unclassified"` sector fallback for a symbol outside `KNOWN_SECTOR_MAP`, net Greeks/directional-exposure/calls-vs-puts derivation, most/least-diversified-area selection, the sector-concentration advisory firing when 3 different symbols share one real sector, determinism, a never-mutates-the-trades-table proof, and the `sectorDataSource` disclosure. |
| `routes/portfolioConcentration.route.test.ts` | Live end-to-end HTTP tests against the real app — a well-shaped result with all 7 breakdown dimensions, the always-unavailable net-beta disclosure, the `sectorDataSource` disclosure, honest credentials/broker-connection disclosure, the never-a-broker-write-surface proof, GET-only/no-request-body behavior, and determinism across repeated calls. |
| `PortfolioConcentration.tsx` | Frontend smoke tests — the always-visible Paper Trading Mode and "Read-Only Portfolio Analysis" badges, loading and error states, the honest empty-portfolio message across every card, net Greeks/net-beta-unavailable/directional-exposure display, the Portfolio Summary card (largest concentration, highest directional exposure, highest Greeks contributor, most/least diversified area, concentration/diversification scores, portfolio health badge), the sector-concentration advisory and its honest no-advisories fallback, long/short and call/put exposure display, the default symbol allocation chart and bucket list, switching the dimension selector to sector, switching sort mode to label A-Z, the minimum-positions filter hiding single-position buckets, the Greeks Contribution chart, the Concentration Heat Map, the Correlation Clusters list, and a never-fabricates-a-beta-figure proof. |
| `lib/portfolioDashboard.ts` | Unit tests against isolated, fresh test users — an empty-portfolio proof (a fully-healthy 100 score across all 8 factors, no fabricated largest position/risk contributor/highest-risk entries, no crash), single-position fully-concentrated factor scoring, balanced multi-symbol portfolios, high-concentration scenarios with guidance surfacing Elevated Concentration and Review Large Positions, an empirically-verified real high-event-risk fixture (AAPL at 45 DTE, matching `portfolioEventRisk.test.ts`'s own established fixture) with guidance surfacing Elevated Event Risk, high-Greeks-exposure scenarios where one position dominates net delta, honest missing-credentials disclosure, the Health Score's own equal-weighted-average formula proven by direct recomputation, the Overall Risk Rating's own deterministic banding, the exact 7 dashboard widgets and their `linkHref`s, visualisation-data pass-through proofs (allocation/expiration/event-timeline/stress-test), determinism, and a never-mutates-the-trades-table proof. |
| `routes/portfolioDashboard.route.test.ts` | Live end-to-end HTTP tests against the real app — a well-shaped executive dashboard with all requested Executive Summary fields, exactly 8 Health Score factors each disclosing its own `sourceModule`, all 9 Risk Panel fields, exactly 7 dashboard widgets each with a real `linkHref`, visualisation data for every requested chart, informational-only guidance, honest credentials/broker-connection disclosure, the never-a-broker-write-surface proof, GET-only/no-request-body behavior, and determinism across repeated calls. |
| `PortfolioDashboard.tsx` | Frontend smoke tests — the always-visible Paper Trading Mode and "Read-Only Portfolio Dashboard" badges, loading and error states, the honest empty-portfolio state (healthy score, no fabricated highlights, honest empty allocation charts), the Executive Summary fields including the Health Score gauge and Overall Risk Rating badge, all 8 Health Score factors rendering by default, sorting factors by Score (Worst First), filtering factors by a minimum-score threshold (including the honest no-factors-match message), all 9 Risk Panel fields, exactly 7 dashboard widget links to their own existing detailed pages, the Portfolio Allocation and Concentration Snapshot charts, the Event Timeline Summary, the Stress Test Summary scenario list, and informational-only guidance rendering with a never-an-execution-action proof. |
| `CommandCenter.tsx` | Frontend smoke tests — the always-visible Paper Trading Mode and "Read-Only Command Center" badges, loading and error states, the Executive Overview fields (Portfolio Value, Buying Power, Health Score, Overall Risk Rating, Broker/Paper Trading Status), Daily P/L reused from the pre-existing Options Income Engine summary, exactly 7 Portfolio Health widget links to their own existing detailed pages, the Options Income Engine section's Iron Condor/Calendar Spread counts and the honest "Not tracked in this engine" disclosure for Wheel Positions/Covered Calls/Cash Secured Puts, Net Delta/Gamma/Theta/Vega from the pre-existing Greeks engine plus the always-honest Beta-unavailable disclosure, the honest no-alerts message, elevated Risk Alerts reused from Concentration/Event Risk guidance plus the worst Stress Test scenario, all 4 Portfolio Allocation charts, the cached (never-auto-fetched) Broker section, and all 5 AI Insights each linking to their own source page with a never-an-execution-recommendation proof. |
| `lib/intelligenceTrend.ts` | Pure unit tests — `insufficient_history` with no prior value, stable-within-threshold, improving/declining beyond a custom threshold, the honest zero-prior-value divide-by-zero fallback, and determinism. |
| `lib/intelligenceLearning.ts` | Pure unit tests — every one of the 11 categories returns at least one real link plus the honestly-disclosed AI Teacher "coming soon" entry, and determinism. |
| `lib/intelligenceObservations.ts` (Explanation Engine) | Pure unit tests for `explainObservation()` against a hand-built literal fixture — the "why"/contributing-metrics/source-module pass-through proofs, the first-real-link review-suggestion derivation, and the honest no-specific-page fallback when every link is "coming soon." |
| `lib/intelligenceHealth.ts` | Tests against a real, isolated-user dashboard plus hand-built prior-snapshot fixtures — the byte-identical-to-the-dashboard's-own-score proof, the worst-first driver sort, the insufficient-history/improving/declining trend branches, the honest broker-disclosure pass-through, and both health-summary wording branches (healthy vs. naming the weakest driver). |
| `lib/intelligenceSummary.ts` | Pure unit tests — every template branch (healthy/moderate/elevated/high-risk headlines, the diversification/theta/concentration/event-risk/buying-power bullet substitutions and their honest omission when no corresponding trend fired), and determinism. |
| `lib/intelligenceTimeline.ts` | Pure diffing tests (new/persistent/resolved classification, `comparedTo`, health/income/risk-rating change population) plus the registry-completeness proof (every one of the 15 known observation codes has a real `labelForCode()` entry) plus real, DB-backed `getPriorSnapshot()`/`recordSnapshotIfNeeded()` upsert tests against an isolated test user (a same-day repeat never inserts a second row; a just-recorded row is never treated as its own prior). |
| `lib/intelligenceEngine.ts` | Unit tests against isolated, fresh test users — an empty/fresh portfolio (exactly `paper_trading_active` + `credentials_unavailable`, never a fabricated trend on the first call), a single position, a balanced/healthy portfolio, high concentration, high Greeks exposure, high event risk, many observations firing together with correct Portfolio/Income/Risk Insights bucketing, missing credentials, timeline/trend observations and health-driver-sort proofs against a manually-recorded real prior snapshot, learning-links deduplication and the always-present AI Teacher entry, at-most-once-per-day persistence, determinism, and a never-mutates-the-trades-table proof. |
| `routes/intelligence.route.test.ts` | Live end-to-end HTTP tests against the real app — a well-shaped deterministic-analysis/Paper-Trading result, the always-present Paper Trading Active observation, a real 0-100 Health Score and rating code, the honestly-disclosed AI Teacher learning link, the never-a-broker-write-surface proof, GET-only/no-request-body behavior, determinism across repeated calls, and a genuine Broker Disconnected scenario via mocked network (mirroring `routes/brokerHealth.route.test.ts`'s own established technique). |
| `InstitutionalIntelligence.tsx` | Frontend smoke tests — all 4 permanent indicator badges, loading and error states, the Executive Summary, the Health Overview (score/rating/trend/drivers), the honest empty and populated Highest Priority states, per-observation severity/category/confidence/source-module rendering, the 3 Insights columns with their own honest empty states, both Timeline states (no prior snapshot vs. a real prior-snapshot comparison with new/resolved entries), real Learning Links, and a never-a-trade-recommendation proof. |
| `lib/glossary.ts` | Pure unit tests — unique keys, no-dangling-cross-reference proof for `relatedTermKeys`, category coverage for all 7 requested categories, `getGlossaryTerm()`'s honest-null-for-unknown-key path, and `searchGlossary()`'s query/category filtering including a genuinely-empty-match proof. |
| `lib/learningPaths.ts` | Pure unit tests — the exact 7-path/47-topic structure and ordering, globally-unique topic keys, every `relatedGlossaryKeys` cross-referenced against `lib/glossary.ts`'s own real keys, every `externalHref` a real, existing platform route (confirmed by direct inspection of `App.tsx`), and `getLearningPath()`/`getLearningTopic()`'s honest-null-for-unknown paths. |
| `lib/strategyAcademy.ts` | Tests reusing the real, unmodified `execution.ts`/`coach.ts` functions — all 10 requested detail fields present and non-empty for all 8 strategies, `builtByThisEngine` correctly split (3 true / 5 false), the 3 live-example strategies' paper examples carry a real SPY symbol/detail/Greeks, the 5 unavailable strategies' paper examples never fabricate a symbol/detail/Greeks, and `getStrategyAcademyEntry()`'s honest-null-for-unknown-key path. |
| `lib/interactiveSimulations.ts` | Pure unit tests reusing the real `bs()`/`computeExpectedMove()` — Delta's rising-curve-through-the-strike proof, Theta's magnitude-grows-near-expiration proof, Expected Move's widens-with-time proof, all 3 payoff diagrams' cap/max-profit/max-loss math (covered call, cash secured put, iron condor), Concentration's HHI scoring and weight-normalization, determinism, and every input-validation error path. |
| `lib/quizProgress.ts` | Pure unit tests — `utcDayKey`'s time-of-day stability, `computeStreak`'s consecutive-day counting/lapse-detection/gap-handling, and `computeQuizProgress`'s best-by-topic/average/improvement/attempts-ordering derivation, with streak proven to come from the full history, not the capped attempts list. |
| `lib/metricExplainer.ts` | Tests against isolated, fresh test users — all 13 requested metric codes resolve a real current value; the Portfolio-Greeks family reuses `coach.ts`'s own plain-English formatters; the portfolio-wide family reuses `buildInstitutionalIntelligence()`/`buildPortfolioDashboard()`; the trade-scoped family requires a `tradeId` (a 400, never a fabricated portfolio-wide substitute, when omitted) and 404s for a `tradeId` belonging to another user; and a structural proof `explainMetric()`'s own signature never accepts a client-supplied value. |
| `lib/learningProgress.ts` | Tests against isolated, fresh test users — a brand-new user's honest all-zero state, `recordViewed`/`recordCompleted` upsert idempotency (never a duplicate row), independent lesson/glossary/strategy tracking, path-completion percentage rollup, recent-history newest-first ordering, and live (never duplicated) reuse of both quiz systems' own results tables. |
| `routes/learningCentre.route.test.ts` | Live end-to-end HTTP tests against the real app — all 12 routes, every 400/404 error path (unknown glossary term/path/strategy, unknown metric, missing tradeId, non-integer tradeId, invalid itemType, unknown simulation type, missing payoff strategy), the labeled-simulation contract (`educationalSimulation`/`notMarketData`/`noTradeRecommendation` always true), and a full view→complete→progress round trip using a collision-free random item key. |
| `routes/valueQuizProgress.route.test.ts` | Live end-to-end HTTP tests — the new `GET /stock-analyst/value-quiz/progress` route's response shape matches the pre-existing `GET /coach/quiz/progress` route's own shape exactly, and a real graded Value Investing quiz attempt is reflected in a subsequent progress read. |
| `lib/intelligenceLearning.test.ts` / `lib/intelligenceEngine.test.ts` / `routes/intelligence.route.test.ts` (updated) | The AI Teacher entry now always resolves to a real `/learn` URL (never `comingSoon`), every category includes the new "Your Portfolio, Explained" deep link, categories with a matching Learning Path topic get a real, reused lesson link, and the 3 platform-status categories (with no matching topic) honestly omit one rather than fabricating it — a disclosed behavior change, not a regression; Observation/Health/Summary/Timeline logic itself is unchanged. |
| `pages/learn/Glossary.tsx` | Frontend smoke tests — full-list rendering, free-text search filtering, the honest empty-match state, a deep-link's focused-term card plus its own view-recording, and the honest not-found message for an unknown term. |
| `pages/learn/StrategyAcademy.tsx` | Frontend smoke tests — list rendering with the "Live Example" badge correctly scoped to only the 3 built-by-this-engine strategies, a live strategy's real paper example rendering, an unavailable strategy's honestly-disclosed unavailable message (never a fabricated detail), and the honest not-found message for an unknown strategy. |
| `pages/learn/LearningPaths.tsx` | Frontend smoke tests — the path list with real completion progress, a path detail's topics collapsed by default, expanding a topic records it viewed and reveals its body plus a Mark Complete button, clicking Mark Complete calls the completion mutation, a deep link to a specific topic auto-opens it, and the honest not-found message for an unknown path. |
| `pages/learn/LearningCentre.tsx` | Frontend smoke tests — the always-visible Paper Trading Mode/Educational Only badges, the Overview tab's real path/strategy/glossary counts and links, running a labeled Simulation from the Simulations tab, a real Explain-Mode-derived explanation on the My Portfolio Explained tab, real lesson/glossary/strategy counts and quiz progress on the Progress tab, and a `?tab=` deep link opening the requested tab directly. |
| `src/components/learn/ExplainButton.tsx` | Frontend smoke tests — the popover never fetches until opened, a real explanation renders with its related-lesson and related-glossary links, `tradeId` is correctly passed through for trade-scoped metrics, an honest error message on a failed fetch (never a fabricated explanation), and switching the metric selector re-fetches the newly-selected metric. |
| `PortfolioDashboard.tsx` / `Portfolio.tsx` / `Trades.tsx` (unmodified assertions) | All pre-existing tests continue to pass unmodified with `<ExplainButton>` wired onto Portfolio Health/Buying Power/Net Greeks/Highest Event Risk/Highest Concentration/Stress Test Summary, Beta-Weighted Delta/Theta/Vega/Gamma, and a per-row trade-scoped Explain button respectively — confirming the button never triggers a network request until clicked. |
| `lib/portfolioAnalyst.ts` | Unit tests against isolated, fresh test users — an empty/fresh portfolio, a healthy (balanced, multi-symbol) portfolio, a large portfolio (8 positions), high concentration, high Greeks exposure, high event risk, high theta income, timeline (against a manually-recorded real prior-day snapshot), learning integration (every strategy cross-link resolving to a real Strategy Academy entry), and persistence discipline (at-most-once-per-day, never mutates trades, deterministic) — plus byte-identical regression proofs against standalone `buildInstitutionalIntelligence()`/`buildPortfolioDashboard()` calls for every reused figure. |
| `routes/portfolioAnalyst.route.test.ts` | Live end-to-end HTTP tests against the real app — a well-shaped result across all 11 sections, the never-a-broker-write/never-a-recommendation-field proof, GET-only/no-request-body behavior, and determinism across repeated calls. |
| `PortfolioAnalyst.tsx` | Frontend smoke tests — all 5 permanent indicator badges, loading and error states, the Executive Daily Briefing, the Portfolio Snapshot (including Net Liquidation/Daily P/L's independent real-vs-unavailable states from `useGetPortfolioSummary()`), the Health Summary's strengths/weaknesses, the Risk Summary (highest risk, largest exposure, worst stress scenario), the Income Summary's theta figures, the Performance Summary's explicit "SIMULATED" labeling and its own honest-unavailable state, the Greeks Summary's 4 current values and largest contributor, the Event Summary's safe/at-risk counts, the Learning Summary's per-section cross-links, both Portfolio Timeline states (no prior snapshot vs. a real prior-snapshot comparison with This Week data), the Institutional Insights list and its honest empty state, and the never-a-trade-recommendation proof. |
| `lib/tradeJournal.ts` | Unit tests against isolated, fresh test users, using real `buildIronCondor()` quotes for internally-consistent P&L — no trade history, a single winning trade (winner-let-run tagging), a single losing trade beyond the stop-loss bound, a loss capped exactly at the stop-loss rule, small and large/oversized positions, diversified and concentrated trade histories (Behaviour Analysis pattern proofs, each naming the real dominant symbol/trade count), high Greeks (large multi-leg position), high event risk (real earnings-event fixture), large trade history (15 trades, real Discipline Score/Behaviour Trend), timeline generation (real, sorted, newest-first timestamps), learning integration (real completed-lesson timeline events plus the never-a-trade-recommendation proof), linked-journal-entry reuse (proving zero new journal writes), persistence discipline (never mutates trades, deterministic), and `buildSingleTradeReview()`'s own honest-null paths (an open/not-yet-closed trade, a nonexistent trade id, another user's own trade). |
| `routes/tradeJournal.route.test.ts` | Live end-to-end HTTP tests against the real app — both routes' well-shaped responses, every Decision Quality tag carrying a real `ruleReference`, a real Discipline Score/decisionQualitySummary aggregate, a Journal Timeline sorted newest-first, the never-a-broker-write/trade-recommendation-field proof, 404 for a nonexistent trade id, 400 for a non-numeric trade id, GET-only/no-request-body behavior, and determinism across repeated calls. |
| `TradeJournal.tsx` | Frontend smoke tests — all 5 permanent indicator badges, loading and error states, the Progress Dashboard's real Closed-Trades/Discipline-Score/rate figures, a real Strength with its supporting trade count and the honest empty-strengths message, a real Area to Improve referencing actual historical trade data and the honest empty-areas message, real Learning Recommendations and the honest empty-recommendations message, a Recent Trades review's full rendering (symbol/P&L/holding-period/decision-quality tags) including its linked journal entry, the honest empty-trades message, the Journal Timeline's real trade-opened/trade-closed entries, a real Behaviour Trend badge, and the never-a-trade-recommendation proof. |
| `lib/institutionalMentor.ts` | Unit tests against isolated, fresh test users, using real `buildIronCondor()` quotes for both open and closed positions — empty portfolio, balanced/diversified portfolio (with real Behaviour Review data), high concentration, strong diversification, high Greeks, large theta income, high event risk (the real `AAPL`/45-day earnings fixture also used by `lib/portfolioEventRisk.test.ts`), and long trade history (12 closed trades) — plus byte-identical regression proofs for every Scorecard score against standalone `buildPortfolioDashboard()`/`buildPortfolioConcentrationOverlay()`/`buildTradeJournal()` calls, a never-writes-to-`intelligence_snapshots` proof, a never-mutates-trades proof, and determinism across repeated same-state calls. |
| `routes/institutionalMentor.route.test.ts` | Live end-to-end HTTP tests against the real app — the well-shaped result (all 9 Scorecard categories with real score/grade/sourceModule/why, real Decision Review statuses, real Capital Allocation/Risk/Income/Behaviour Review figures, a real Institutional Lessons cross-link for every section), the never-a-broker-write/order-creation/trade-recommendation-field proof, GET-only/no-request-body behavior, and determinism across repeated calls. |
| `InstitutionalMentor.tsx` | Frontend smoke tests — all 5 permanent indicator badges, loading and error states, all 9 Portfolio Scorecard entries with their real score/grade, real Professional Review observations and the honest empty-review message, Decision Review items with their status badge and detail, the Capital Allocation Review's cash-utilisation/buying-power/allocation-breakdown figures, the Risk Review's largest-risk/contributor/worst-stress-scenario figures, the Income Review's real Theta Income projection figures, the Behaviour Review's real pass-through of the AI Trade Journal's own figures (including the honest empty-areas-to-improve message), a real Institutional Lessons cross-link including the Explain Mode link, and the never-a-trade-recommendation proof. |

## 8. Cross-references

- `docs/Broker-Health-API.md` — the account-verification (`/broker/health`)
  endpoint's own full detail, including its UI panel on the Settings page.
- `docs/Trading-Journal.md` — the Trading Journal system's own full detail
  (the new `thesis`/`entryReasoning` columns, how entries are edited from
  the Trade History detail panel, the AI-review placeholder, and the
  broker-reconciliation summary integration described in §4.7 above).
- `docs/Order-Preview.md` — the Order Preview & Risk Simulator's own full
  detail (§4.8 above): the 4 derived display fields' formulas, the 8-item
  pre-trade checklist's exact semantics, and its relationship to
  `execution.ts`'s own real, unmodified pre-trade risk gate.
- `docs/Position-Sizing.md` — the Position Sizing & Portfolio Impact
  Calculator's own full detail (§4.9 above): the recommended-quantity
  formula, the break-even derivation, the current-vs-hypothetical
  portfolio-impact model, the 8-category risk-warnings list, and the
  scenario-comparison design.
- `docs/Trade-Adjustment.md` — the Trade Adjustment & Roll/Convert Preview
  Simulator's own full detail (§4.10 above): the reused adjustment
  engine's real capability boundary, the 3-computable/5-honestly-
  unavailable intent scope decision, the Close & Replace composition, the
  replace-semantics portfolio exposure model, the 9-category
  risk-warnings list, and the Improved/Worse/Neutral comparison design.
- `docs/Portfolio-Stress-Testing.md` — the Portfolio Stress Test &
  Scenario Simulator's own full detail (§4.11 above): the shock-
  parameterized repricing engine and its zero-shock equivalence proof,
  the portfolio-level aggregation model, the honestly-always-zero
  buying-power-impact disclosure, the risk-score formula, the risk-
  analysis fields, and the scenario-comparison design.
- `docs/Portfolio-Event-Risk.md` — the Earnings & Event Risk Portfolio
  Overlay's own full detail (§4.12 above): the honest disclosure of the
  2 requested-but-unsupported event categories, the direct
  `getEventRiskForSymbol()` reuse, the Risk Guidance label mapping, the
  confidence/source disclosure model, and the portfolio summary
  derivation.
- `docs/Portfolio-Correlation-Concentration.md` — the Correlation &
  Concentration Risk Overlay's own full detail (§4.13 above): the
  always-unavailable net-beta disclosure, the `KNOWN_SECTOR_MAP`
  categorical-metadata precedent borrowed from Engine 1's own
  `lib/industryPeers.ts`, the concentration-weight-vs-portfolio-weight
  distinction, the Herfindahl-Hirschman-Index concentration scoring, the
  categorical-clustering-only correlation model, and the Portfolio
  Summary/Risk Guidance derivation.
- `docs/Portfolio-Dashboard.md` — the Portfolio Risk Dashboard & Health
  Score's own full detail (§4.14 above): the 8-factor Health Score
  design discipline and its exact derivation table, the equal-weighted
  averaging formula, the 4-tier Overall Risk Rating banding, the 7
  dashboard widgets and their existing detail-page links, and the
  disclosed `getSettingsRow()` concurrency fix.
- `docs/Institutional-Command-Center.md` — the Institutional Command
  Center's own full detail (§4.15 above): the per-section data-source
  table, the disclosure distinguishing this page from the pre-existing
  `/institutional-dashboard`, the honest "not tracked in this engine"
  disclosure for Wheel Positions/Covered Calls/Cash Secured Puts, the
  one small additive `netBeta` backend extension, and the navigation
  changes that install it as the primary landing page.
- `docs/Institutional-Intelligence-Engine.md` — the Institutional
  Intelligence Engine's own full detail (§4.16 above): the 6-service
  architecture (Observation, Explanation, Health, Summary, Timeline,
  Learning Engines), the 11 deterministic observation rules and their
  confidence-banding discipline, the `intelligence_snapshots` table's
  history-keeping (not prediction) design, and the remaining AI roadmap
  this engine is the foundation for.
- `docs/AI-Teacher-Learning-Centre.md` — the AI Teacher & Learning
  Centre's own full detail (§4.17 above): the 7 structured Learning
  Paths (47 topics), the 8-entry Strategy Academy, the ~52-term
  Glossary, Contextual Explain Mode's genuine reuse of the Institutional
  Intelligence Engine's own Explanation Engine, Portfolio Learning
  Mode, the 5 deterministic Interactive Simulations, the unified
  Learning Progress tracking (the only new user-state mutation), and
  the reunification of the Greeks quiz and Value Investing quiz into
  one shared progress system.
- `docs/AI-Portfolio-Analyst.md` — the AI Portfolio Analyst's own full
  detail (§4.18 above): the executive portfolio briefing layer's
  pure-composition architecture over the Institutional Intelligence
  Engine/Portfolio Dashboard/Portfolio Event Risk/Theta Income, the
  disclosed sequential-not-`Promise.all` `getSettingsRow()` race fix,
  the new "This Week" 7-day rollup, and the disclosed SIMULATED-vs-real
  engine boundary for the Performance Summary section.
- `docs/AI-Trade-Journal.md` — the AI Trade Journal's own full detail
  (§4.19 above): the Trade Review/Decision Quality/Behaviour Analysis
  architecture, the 3 disclosed trivial-generalization helpers
  (`computeGreeksAsOf()`/`deriveLotQuantity()`/`tradeHoldingPeriodDays()`),
  the genuine historical reconstruction of Event Risk at Entry, the
  disclosed per-trade Maximum Drawdown data-availability gap, and the
  read-only reuse of the pre-existing Trading Journal's own linked
  entries.
- `docs/Institutional-Mentor.md` — the Institutional Mentor's own full
  detail (§4.20 above): the 9-category Portfolio Scorecard's source-
  module traceability table, the Professional Review/Decision Review
  deterministic template techniques, the Capital Allocation/Risk/Income/
  Behaviour narrative reviews, the disclosed Income Generation
  threshold-banding constants (the sole genuinely new figure this
  sprint introduces), the real 7-day Diversification trend, and the
  confirmation that this module never writes to `intelligence_snapshots`.
- `docs/Operations-Handbook.md` §6.5 — day-to-day operational usage of both
  the Broker Health check and this reconciliation panel.
- `.agents/memory/auto-execution-engine.md` — the protected execution
  engine's own invariants, unaffected by and unrelated to this read-only
  work.
- `docs/Phase-9-Production-Readiness-Report.md` (and its 5 sibling
  Phase-9 reports) — a production-hardening pass over this platform:
  a global frontend error boundary, a global backend error-handling
  middleware, process-level crash handlers, a dependency-free security-
  headers middleware, explicit database connection pool configuration,
  3 new database indexes (`journal_entries.trade_id`,
  `scanner_results(user_id, status)`, `trades(user_id, status)`), a
  batched `ensureSeedTrades()` insert, and the removal of 27 confirmed-
  unused frontend component files. Zero lines of `execution.ts`,
  `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, or `autoAdjustment.ts`
  were touched — confirmed via `git diff --stat` before and after.
- `docs/Institutional-Control-Center.md` — Phase 10 (Institutional
  Platform Polish & Control Center)'s own full detail: the new
  Institutional Home landing page (a genuine 13-widget Personal
  Dashboard, deliberately built as a new `pages/Home.tsx` rather than a
  rewrite of the pre-existing `Institutional Command Center` page,
  which moved unmodified to `/command-center`), the Workspace System
  (`dashboard_workspaces` table, 7 new `/workspaces*` routes, the
  partial-unique-index active-workspace guarantee — deliberately the
  same underlying mechanism as the Personal Dashboard, not a second
  persistence system), the Global Command Palette / Global Search
  (⌘K/Ctrl+K, built on the pre-existing, previously-unused
  `cmdk`-based `command.tsx`, deliberately the one dialog serving both
  roles), the shared Quick Actions list (including a genuine
  client-side CSV portfolio export), and the new Notification Centre
  page (a read-only, "no recommendations" aggregation of 7 categories,
  distinct from and cross-linked with the pre-existing header
  `NotificationBell`). Zero lines of `execution.ts`, `optionsMath.ts`,
  `risk.ts`, `autoExecution.ts`, or `autoAdjustment.ts` were touched —
  confirmed via `git diff --stat` before and after.
- `docs/Live-Market-Validation.md` — Phase 11 (Live Market Operations &
  Production Validation)'s own additions to `lib/providers/alpacaBroker.ts`:
  `getAlpacaMarketClock()`/`getAlpacaMarketCalendar()` (the same Alpaca
  Trading API family as the existing account/positions/orders calls,
  added to the same file rather than a new one), consumed by a new
  `lib/marketCalendar.ts` (a US market clock with a static, formula-
  derived holiday-calendar fallback for when no Alpaca credentials are
  configured) and a new cross-provider validation report,
  `lib/liveMarketValidation.ts`, consolidating the Options Engine's,
  Engine 1's, and Engine 2's own already-existing provider-status
  systems — zero of which were rebuilt.
- `docs/Broker-Reconciliation.md` — Phase 11's own persisted
  reconciliation-report history (`broker_reconciliation_reports`,
  `POST`/`GET /broker/reconciliation/reports`), built entirely on top
  of this document's own §4 reconciliation comparison logic, which
  remains completely unmodified.
- `docs/Operations-Runbook.md` — Phase 11's own background-job audit,
  the new Operations Dashboard (`/operations`, administrator-only via
  the first role-based route gate in this codebase's history), and its
  security review.
