# Order Preview & Risk Simulator

This document covers the Order Preview & Risk Simulator as it exists after
the **Paper Trading Order Preview & Risk Simulator** sprint. It is a
companion to `docs/Alpaca-Paper-Trading-Architecture.md` §4.8, which covers
the same sprint at a higher level alongside the rest of the Alpaca
integration — read that document for the broader architectural context;
this one is scoped to the preview page and its endpoint in detail.

---

## 1. What this is

A dedicated, read-only, dry-run page — `/order-preview` ("Order Preview &
Risk Simulator") — where a user types in a symbol, strategy, and quantity
and sees a full estimate of what that order would look like, **before it
is ever submitted, and without any way to submit it from this page.**

**This page performs no broker writes. No order is ever created. No local
portfolio state is ever mutated. No execution logic was modified. No
routing logic was modified. No risk calculations were changed.**

Every number shown is either:
1. A direct, unmodified reuse of `execution.ts`'s own existing
   `previewOptionOrder()` (itself an alias for the same `buildTicket()`
   the real order-submission path calls) — net credit/debit, max profit,
   max loss, buying power required, and the full pre-trade risk
   validation checklist (`validatePreTrade`'s own checks/violations/
   warnings), or
2. A small, disclosed, honest **derivation** on top of those same numbers
   (entry price per spread, notional value, margin impact, risk/reward
   ratio) — never an invented or fabricated figure, and never a real
   broker-reported value presented as one, or
3. A read of already-existing, already-cached state (Alpaca credential
   presence, the outcome of the most recent Broker Health check) — never a
   new live broker call triggered by this page.

---

## 2. Backend: `POST /execution/order-preview`

New files this sprint, both purely additive:
- `artifacts/api-server/src/lib/orderPreview.ts` — `buildOrderPreview(input, userId)`,
  the composition function.
- `artifacts/api-server/src/routes/orderPreview.ts` — the one new route.

`execution.ts`, `optionsMath.ts`, and `risk.ts` are **not modified** by
this sprint — confirmed via `git diff --stat` at every checkpoint.

### 2.1 Request

```json
{ "symbol": "AAPL", "strategy": "iron_condor", "quantity": 1 }
```

All three fields are optional/nullable at the schema level, deliberately —
so a genuinely missing field produces a clean, structured validation
message (see §3) rather than a hard HTTP 400. (A field with the wrong
*type* — e.g. `quantity: "not-a-number"` — still 400s at the Zod-schema
layer, since that's a malformed request, not a business-level validation
case.)

### 2.2 Response shape

```
{
  available: boolean,
  inputIssues: [{ field, code, message }],
  ticket: null | {
    // ...every existing ExecutionTicket field, reused unmodified...
    entryPricePerSpread: number,
    notionalValue: number,
    marginImpact: number,
    riskRewardRatio: number | null,
  },
  preTradeChecklist: [{ code, label, status: "ok"|"warning"|"blocked", detail }],
  credentialsConfigured: boolean,
  brokerConnected: boolean | null,
  lastBrokerCheckAt: string | null,
  accountValue: number,
  generatedAt: string,
}
```

`available: false` means the input itself couldn't be resolved into a
ticket at all (missing/invalid symbol, strategy, or quantity) — `ticket`
is honestly `null` in that case, never a partial or fabricated one.
`available: true` always means a full, real ticket was built via the same
code path the real submit endpoint (`POST /execution/submit`) uses to
build its own ticket before submission.

---

## 3. The 4 derived display fields

| Field | Formula | Notes |
|---|---|---|
| Estimated Entry Price | `netCredit / quantity` | Net credit (positive) or debit (negative) per single spread. |
| Estimated Notional Value | `Σ (strike × 100 × ratioQty × quantity)` across legs | The standard options-notional formula (contract multiplier 100). **Not** the same figure as capital at risk (`maxLoss`) — shown as a separate field. |
| Estimated Margin Impact | `= maxLoss` | For these all-defined-risk multi-leg spread strategies, margin requirement equals maximum loss — reused directly, not a new calculation. |
| Risk/Reward Ratio | `maxProfit / maxLoss` | Honestly `null` (shown as "N/A") when `maxLoss` is 0. |

---

## 4. The 8-item pre-trade checklist

Requested categories, and exactly how each is computed. **None of these
are part of `execution.ts`'s own real pre-trade risk gate** (that gate's
own output — `validatePreTrade`'s checks/violations/warnings — is shown
separately, unmodified, as part of the reused `ticket.validation` field).
Since this page never submits an order, none of these 8 items are ever a
"this order would be rejected" statement — they are purely informational,
each labeled `ok`, `warning`, or `blocked`:

1. **Missing required fields** (`required_fields`) — `blocked` if symbol,
   strategy, or quantity is missing from the request.
2. **Invalid quantity** (`quantity_valid`) — `blocked` if quantity isn't a
   positive whole number.
3. **Invalid symbol** (`symbol_valid`) — `blocked` if the symbol fails a
   shape check (1-6 letters) or — for a shape-valid symbol — fails to
   resolve via `canonicalQuote()` (reused, unmodified, from
   `execution.ts`; e.g. anything outside the fixed 10-symbol SIMULATED
   options universe).
4. **Buying power unavailable** (`buying_power`) — `blocked` only if the
   local account value itself is non-positive (practically unreachable);
   `ok` when the most recent Broker Health check succeeded (a real,
   verified buying-power figure exists); otherwise `warning`, with the
   figure shown honestly labeled as a **local estimate only**, not
   verified against Alpaca.
5. **Broker disconnected** (`broker_connection`) — `ok` only when the most
   recent `GET /broker/health` check reported `connected: true`;
   `warning` otherwise (including "never checked this session").
6. **Missing credentials** (`credentials`) — reads
   `readAlpacaCreds()` (reused, unmodified) against the calling user's
   settings row; `warning` when absent (the normal, expected state before
   a user connects Alpaca — this preview still works fully without them).
7. **Position conflict** (`position_conflict`) — `warning` if this user
   already has a trade with `status = 'open'` in the entered symbol. A
   `closed` trade in the same symbol never trips this.
8. **Existing open order warning** (`existing_order`) — `warning` if this
   user already has a trade with `status = 'pending'` (submitted but not
   yet filled) in the entered symbol.

---

## 5. Broker status context

The page's "Broker Connection Status" section reads the same,
already-existing `GET /broker/health` endpoint (unmodified) via the same
`enabled: false` + explicit "Refresh Broker Health" button convention
every broker-touching page in this app follows — it never fetches
automatically on page load, and it is a completely independent action from
"Preview Only."

`lastBrokerCheckAt`/`brokerConnected` on the preview response itself are
sourced from `alpacaBroker.ts`'s own already-existing in-memory
last-check state (`getLastSuccessfulBrokerCheck()`/
`getLastBrokerCheckConnected()`) — reading it never triggers a new live
call; only clicking "Refresh Broker Health" does.

---

## 6. What this sprint did not change

- `execution.ts`, `optionsMath.ts`, `risk.ts` — zero-line diff.
- `routes/execution.ts`'s existing `/execution/preview`/`/execution/submit`
  routes — unmodified, still the real preview/submission path.
- No database migration.
- No broker write operations of any kind.

---

## 7. Cross-references

- `docs/Alpaca-Paper-Trading-Architecture.md` §4.8 — the higher-level
  architectural summary of this same sprint, alongside the rest of the
  Alpaca Paper Trading integration.
- `docs/Broker-Health-API.md` — the underlying `GET /broker/health`
  endpoint this page's Broker Connection Status section reuses.
- `docs/Operations-Handbook.md` — day-to-day operational usage.
- CLAUDE.md rule 1 — `execution.ts` is never modified without explicit,
  specific approval; this sprint's own composition layer reuses it, never
  duplicates or bypasses its logic.
