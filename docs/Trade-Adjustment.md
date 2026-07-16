# Trade Adjustment & Roll/Convert Preview Simulator

This document covers the Trade Adjustment & Roll/Convert Preview Simulator
as it exists after the **Trade Adjustment & Roll/Convert Preview
Simulator** sprint. It is a companion to
`docs/Alpaca-Paper-Trading-Architecture.md` §4.10, which covers the same
sprint at a higher level alongside the rest of the Alpaca integration —
read that document for the broader architectural context; this one is
scoped to the simulator itself in detail. It also directly extends
`docs/Position-Sizing.md` (the prior sprint) — read that document first if
you haven't already.

---

## 1. What this is

A dedicated pre-decision simulator, `/adjustment-preview`, that takes an
existing open position and a proposed adjustment intent and shows a full
Before/After comparison — without ever placing, closing, or modifying a
real order.

1. **Adjustment Preview** — pick an open position and one of 8 adjustment
   intents. Only 3 are genuinely computable by this platform's existing
   adjustment engine (see §2); the other 5 are honestly reported
   unavailable, never fabricated.
2. **Display** — existing position, proposed position, debit/credit,
   estimated buying power/margin impact, max risk/reward before and
   after, Greeks before/after, portfolio exposure before/after,
   concentration before/after, risk/reward comparison, break-even
   comparison.
3. **Validation warnings** — 9 informational categories.
4. **Comparison** — a side-by-side Before/After view that classifies each
   metric as Improved, Worse, or Neutral.

**All calculations reuse this platform's existing execution and
adjustment logic. No execution logic was modified. No routing logic was
modified. No broker writes occur. No orders are submitted. Portfolio
impact remains hypothetical** — every one of these is true by
construction, not just by convention, and is proven by this sprint's own
test suite (see §7).

---

## 2. The reused adjustment engine's real capability boundary

Before building anything, this sprint investigated `execution.ts`'s
`buildAdjustmentTicket()`/`resolveAdjustmentTarget()`/internal
`buildAdjustmentQuote()` in detail (read-only). Two facts drove every
design decision below:

1. **The engine supports exactly 2 real adjustment shapes.** "Roll"
   always re-centers every strike on the current spot price at a fixed
   45-day cycle (`buildIronCondor(snap, {dte: 45})`, etc.) — there is no
   parameter for shifting strikes independently of re-centering, and no
   parameter for extending expiration while holding strikes fixed.
   "Convert" only tightens/widens between Iron Condor and Iron Fly.
2. **`buildAdjustmentTicket()` hard-gates on eligibility.** It calls
   `evaluateTradeAdjustment()` on the position first and throws a 409
   `TicketError` unless the recommendation is one of
   `ROLLABLE_ACTIONS = {roll_threatened, roll_untested, convert}`. There
   is no way to preview a roll/convert quote for a position the real
   engine wouldn't recommend one for.

### 2.1 Scope decision — 3 computable intents, 5 honestly unavailable

Of the 8 intents this sprint's spec requested, only 3 are genuinely
computable without writing new strike-selection logic (explicitly out of
this sprint's reuse-only scope):

| Intent | Computable? | How |
|---|---|---|
| **Roll Forward** | Yes | Maps to the real "roll" — only succeeds when the position is roll-eligible (`roll_threatened`/`roll_untested`). |
| **Convert Position** | Yes | Maps to the real "convert" — only succeeds when the position is convert-eligible. |
| **Close & Replace** | Yes | New, small composition (see §3) — works for **any** open position, regardless of its own adjustment recommendation. |
| Roll Out | No | Always honestly `available: false`. |
| Roll Up | No | Always honestly `available: false`. |
| Roll Down | No | Always honestly `available: false`. |
| Roll Out & Up | No | Always honestly `available: false`. |
| Roll Out & Down | No | Always honestly `available: false`. |

The 5 unavailable intents all report the same consistent, disclosed
reason (`STRIKE_SHIFT_UNAVAILABLE_REASON`):

> "This simulator's reused engine always re-centers every strike on the
> current spot price at a fixed 45-day cycle for a roll — it has no
> parameter for shifting strikes independently of re-centering, or for
> extending expiration while holding strikes fixed. This adjustment shape
> cannot be honestly distinguished from Roll Forward without new
> strike-selection logic outside this sprint's reuse-only scope."

This follows the same "never fabricate, always disclose gaps" precedent
already established by Order Preview's sector-exposure-unavailable
disclosure and Position Sizing's calendar-spread-break-even-unavailable
disclosure — rather than inventing new strike-selection logic (which
would mean writing genuinely new pricing logic, a materially larger and
differently-scoped change) or silently hiding the unsupported options
from the picker.

---

## 3. Backend: `POST /execution/adjustment/preview-simulator`

New files this sprint, both purely additive:
- `artifacts/api-server/src/lib/tradeAdjustmentPreview.ts` —
  `buildTradeAdjustmentPreview(input, userId)`.
- `artifacts/api-server/src/routes/tradeAdjustmentPreview.ts` — the one
  new route, deliberately a distinct path
  (`/execution/adjustment/preview-simulator`) from the existing real
  `/execution/adjustment/preview` (used by the actual roll/convert
  submission flow leading to `/execution/adjustment/submit`).

`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, and
`autoAdjustment.ts` are **not modified** by this sprint — confirmed via
`git diff --stat` at every checkpoint.

`lib/positionSizing.ts`'s `TradeRow`/`currentOpenTrades()`/
`buildSnapshot()` were made `export`ed (a purely additive keyword change,
zero logic change) so this sprint could reuse the exact same
portfolio-aggregation logic from last sprint rather than duplicating it.

### 3.1 Request

```json
{ "tradeId": 42, "intent": "roll_forward", "quantity": 2 }
```

`quantity` is optional — when omitted, the existing position's own
current lot count is used.

### 3.2 Response shape (abbreviated)

```
{
  available: boolean,
  inputIssues: [{ field, code, message }],
  intent: AdjustmentIntent | null,
  intentAvailable: boolean,
  intentUnavailableReason: string | null,
  existingPosition: AdjustmentSourcePosition | null,
  proposedPosition: ExecutionTicket | null,   // reused, unmodified shape
  netCashflow: number | null,                 // proposed.netCredit - existing.costToClose
  greeksBefore: PositionGreeks | null,
  greeksAfter: PositionGreeks | null,
  breakEvenBefore: { breakEvens: BreakEvenPrice[], unavailableReason: string | null },
  breakEvenAfter: { breakEvens: BreakEvenPrice[], unavailableReason: string | null },
  portfolioExposureBefore: PortfolioSnapshot,   // reused shape from Position Sizing
  portfolioExposureAfter: PortfolioSnapshot | null,
  comparisons: MetricComparison[],              // 6 items
  riskWarnings: TradeAdjustmentWarning[],       // 9 items
  generatedAt: string,
}
```

`proposedPosition`/`netCashflow`/`portfolioExposureAfter`/`greeksAfter`/
`breakEvenAfter` are honestly `null` whenever `available` is `false` —
never a partial or fabricated object.

---

## 4. How each figure is computed

| Field | Source |
|---|---|
| Existing position | Loaded via a plain, ownership-scoped `SELECT` against `trades`, then `evaluateTradeAdjustment()` (reused, unmodified) for its own eligibility read. |
| Proposed position (Roll Forward / Convert) | `buildAdjustmentTicket()` (reused, unmodified) — the exact same function the real submission flow calls. |
| Proposed position (Close & Replace) | `previewOptionOrder()` (reused, unmodified, from last sprint's Order Preview) — bypasses `buildAdjustmentTicket()`'s eligibility gate entirely, since closing and re-opening fresh is valid for any position. |
| Net cashflow | `proposed.netCredit − existing.costToClose` — a disclosed derivation over two already-computed figures. |
| Greeks before/after | `computeTradeGreeks()` (reused, unmodified, from `serverState.ts` — the same function Position Sizing and the Engine 3 dashboard already use). |
| Break-evens before/after | The same generalized credit-spread formula Position Sizing established (§4 of `docs/Position-Sizing.md`), computed only for iron condor/iron fly — calendar spreads honestly report unavailable. |
| Portfolio exposure before | `buildSnapshot()` (reused, exported this sprint) over all current open trades. |
| Portfolio exposure after | `buildSnapshot()` over all open trades **excluding** the source position, **plus** a synthetic reconstruction of the proposed position — correctly modeling *replace* semantics (distinct from Position Sizing's own simpler *add* model). |
| Concentration / risk / reward comparisons | `compareMetric()` — a small, disclosed function producing a `MetricComparison` (before, after, absolute/percent change, and a direction: improved/worse/neutral/unknown) for each of 6 metrics: max risk, max reward, buying power impact, margin impact, risk/reward ratio, concentration. Neutral threshold: `|change| < 0.01`. |

### 4.1 Reconstructing the "after" position for exposure purposes

The same technique Position Sizing established for its hypothetical
portfolio: the proposed ticket's own public `legs: OrderLeg[]` array
(each leg's `ratioQty × proposed.quantity` reproduces the true lot-scaled
leg quantity, matching `execution.ts`'s own internal `storedLegs`
construction exactly) is used to build a synthetic `TradeRow`, never a
second private call into `execution.ts` and never persisted anywhere.

---

## 5. Risk Warnings (9 categories)

| Code | Source |
|---|---|
| `missing_position` | New — the requested `tradeId` doesn't resolve to an open position owned by the calling user. |
| `invalid_adjustment` | New — the requested intent is one of the 5 always-unavailable strike-shift shapes, or the position isn't roll/convert-eligible for the requested Roll Forward/Convert intent. |
| `buying_power_unavailable` | Reused pattern from Order Preview/Position Sizing — no successful account-value resolution this session. |
| `broker_disconnected` | Reused, unmodified, from Order Preview's checklist. |
| `missing_credentials` | Reused, unmodified, from Order Preview's checklist. |
| `excess_concentration` | Reused, relabeled, from `execution.ts`'s own `validatePreTrade` "Total portfolio risk" check, evaluated against the *after* exposure. |
| `excess_leverage` | Reused threshold (`ADJUSTMENT_LEVERAGE_RATIO = 3`, matching Position Sizing's own `MAX_LEVERAGE_RATIO`) on `notionalValue ÷ accountValue` for the proposed position. |
| `conflicting_order` | New — a pending order already exists for the same symbol (excluding the source trade itself). |
| `conflicting_adjustment` | New — a *different* open position in the same symbol also currently has its own roll/convert-eligible recommendation, so acting on one first may change the picture for the other. |

Since this page never submits an order or adjustment, every warning here
is purely informational — nothing is ever blocked from actually
happening, because nothing is ever sent.

---

## 6. Comparison — Improved / Worse / Neutral

Every one of the 6 `comparisons` entries carries an explicit `direction`
so the frontend never has to re-derive "is a lower number better here" —
`compareMetric()` takes an explicit polarity per metric (e.g. lower max
risk is "improved," a higher risk/reward ratio is "improved") and applies
the shared `|change| < 0.01` neutral threshold consistently across all 6.

---

## 7. What this sprint did not change

- `execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
  `autoAdjustment.ts` — zero-line diff.
- `buildAdjustmentTicket()`/`resolveAdjustmentTarget()`/
  `previewOptionOrder()` — unmodified, called as-is.
- No database migration.
- No broker write operations of any kind.
- No adjustment, roll, convert, close, or replace is ever actually
  submitted from this page — there is no submit action anywhere on it.

---

## 8. Cross-references

- `docs/Alpaca-Paper-Trading-Architecture.md` §4.10 — the higher-level
  architectural summary of this same sprint.
- `docs/Position-Sizing.md` — the prior sprint this one directly extends
  (shared `buildSnapshot()`/`currentOpenTrades()` reuse).
- `docs/Order-Preview.md` — the sprint whose `previewOptionOrder()` call
  and checklist-warning conventions this sprint's Close & Replace intent
  and warnings list both build on.
- `docs/Operations-Handbook.md` — day-to-day operational usage.
- CLAUDE.md rule 1 — `execution.ts` is never modified without explicit,
  specific approval; this sprint's own composition layer reuses it, never
  duplicates or bypasses its logic.
- `.agents/memory/trade-adjustment-engine.md` — the protected adjustment
  engine's own invariants, unaffected by and unrelated to this read-only
  simulator.
