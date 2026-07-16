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

## 8. Cross-references

- `docs/Broker-Health-API.md` — the account-verification (`/broker/health`)
  endpoint's own full detail, including its UI panel on the Settings page.
- `docs/Trading-Journal.md` — the Trading Journal system's own full detail
  (the new `thesis`/`entryReasoning` columns, how entries are edited from
  the Trade History detail panel, the AI-review placeholder, and the
  broker-reconciliation summary integration described in §4.7 above).
- `docs/Operations-Handbook.md` §6.5 — day-to-day operational usage of both
  the Broker Health check and this reconciliation panel.
- `.agents/memory/auto-execution-engine.md` — the protected execution
  engine's own invariants, unaffected by and unrelated to this read-only
  work.
