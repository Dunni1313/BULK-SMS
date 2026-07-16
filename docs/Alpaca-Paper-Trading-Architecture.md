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
- `docs/Operations-Handbook.md` §6.5 — day-to-day operational usage of both
  the Broker Health check and this reconciliation panel.
- `.agents/memory/auto-execution-engine.md` — the protected execution
  engine's own invariants, unaffected by and unrelated to this read-only
  work.
