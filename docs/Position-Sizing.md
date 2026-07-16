# Position Sizing & Portfolio Impact Calculator

This document covers the Position Sizing & Portfolio Impact Calculator as
it exists after the **Position Sizing & Portfolio Impact Calculator**
sprint. It is a companion to `docs/Alpaca-Paper-Trading-Architecture.md`
§4.9, which covers the same sprint at a higher level alongside the rest of
the Alpaca integration — read that document for the broader architectural
context; this one is scoped to the calculator itself in detail. It also
directly extends `docs/Order-Preview.md` (the prior sprint) — read that
document first if you haven't already.

---

## 1. What this is

A dedicated pre-trade calculator, `/position-sizing`, that takes a
symbol/strategy/quantity (and an optional custom scenario quantity) and
shows:

1. **Position Sizing** — recommended size, buying power/concentration
   impact, capital at risk, break-evens, risk/reward.
2. **Portfolio Impact** — a clearly-labeled **Current Portfolio** (real,
   already-open positions) side by side with a **Hypothetical
   Post-Preview Portfolio** (current positions + the previewed order,
   simulated only, never real).
3. **Risk Warnings** — 8 informational categories.
4. **Scenario Comparison** — 50%/75%/100%/custom quantity.

**All calculations reuse this platform's existing execution and options
logic. No execution logic was modified. No broker writes occur. No orders
are submitted. Portfolio impact is hypothetical only** — every one of
these is true by construction, not just by convention, and is proven by
this sprint's own test suite (see §7).

---

## 2. Backend: `POST /execution/position-sizing`

New files this sprint, both purely additive:
- `artifacts/api-server/src/lib/positionSizing.ts` —
  `buildPositionSizingAnalysis(input, userId)`.
- `artifacts/api-server/src/routes/positionSizing.ts` — the one new route.

`execution.ts`, `optionsMath.ts`, and `risk.ts` are **not modified** by
this sprint — confirmed via `git diff --stat` at every checkpoint.

### 2.1 Request

```json
{ "symbol": "AAPL", "strategy": "iron_condor", "quantity": 2, "customQuantity": 5 }
```

Same shape as last sprint's `OrderPreviewInput`, plus one new optional
field, `customQuantity` (used only by the Scenario Comparison section).

### 2.2 Response shape (abbreviated)

```
{
  preview: OrderPreviewResult,          // reused, unmodified, from lib/orderPreview.ts
  positionSizing: null | {
    recommendedQuantity, positionSizePctOfPortfolio, buyingPowerUtilizationPct,
    capitalAtRisk, maxTheoreticalLoss, maxTheoreticalGain,
    breakEvens: [{ label, price }], breakEvenUnavailableReason,
    riskRewardRatio, concentrationBeforePct, concentrationAfterPct,
  },
  portfolioImpact: {
    current: PortfolioSnapshot,
    hypothetical: null | PortfolioSnapshot,
    sectorExposure: { available: false, reason },   // always this shape
    deltaImpact, thetaImpact, gammaImpact, vegaImpact,
  },
  riskWarnings: [{ code, label, status: "ok"|"warning"|"blocked", detail }],  // 8 items
  scenarios: [{ label, quantity, available, unavailableReason, capitalAtRisk, buyingPowerRequired, buyingPowerUtilizationPct, concentrationAfterPct, positionSizePctOfPortfolio }],
  generatedAt: string,
}
```

`PortfolioSnapshot` = `{ openPositionsCount, totalRiskDollars, totalRiskPct, exposureBySymbol: [{symbol, riskDollars, pctOfAccount}], longExposureDollars, shortExposureDollars, greeks: {delta, gamma, theta, vega} }`.

`positionSizing`/`portfolioImpact.hypothetical` are honestly `null` when
`preview.available` is `false` — never a partial or fabricated object.

---

## 3. Position Sizing figures — where each number comes from

| Field | Source |
|---|---|
| Recommended position size | **New formula**, but built only from already-existing pieces: a 1-lot reference ticket (`previewOptionOrder()`, reused) gives per-spread max loss; `floor((accountValue × settings.maxRiskPerTrade / 100) / oneLotMaxLoss)` applies the account's own already-enforced per-trade cap backwards into a suggested quantity. |
| Position size % of portfolio | `= ticket.riskPct` (reused, `execution.ts`'s own `validatePreTrade` output). |
| Buying power utilization | `buyingPowerRequired ÷ accountValue` — a disclosed % derivation. |
| Capital at risk / Max theoretical loss | `= ticket.maxLoss` (same figure, both labels). |
| Max theoretical gain | `= ticket.maxProfit`. |
| Break-even price(s) | **New, disclosed derivation** — see §4. |
| Risk/Reward ratio | `= ticket.riskRewardRatio` (already derived last sprint). |
| Concentration before/after trade | `= ticket.portfolioRiskBeforePct` / `portfolioRiskAfterPct` (reused, `execution.ts`'s own output). |

---

## 4. Break-even derivation

Computed **only for iron condor and iron fly** — both are single-expiration
credit spreads with a well-defined linear payoff at expiration. Calendar
spreads and earnings plays involve multiple expirations, so a simple
break-even formula would misrepresent the real payoff; those two
strategies honestly return `breakEvens: []` with an explicit
`breakEvenUnavailableReason`, never an approximated number.

For the supported strategies, the short put/call strikes are identified
purely from the already-public `ticket.legs` array (`side === "sell"`),
and the standard credit-spread formula is applied:

```
creditPerShare = ticket.entryPricePerSpread / 100
lowerBreakEven = shortPutStrike  - creditPerShare
upperBreakEven = shortCallStrike + creditPerShare
```

For an iron fly, `shortPutStrike === shortCallStrike` (a short straddle) —
the same formula still holds.

---

## 5. Portfolio Impact — current vs. hypothetical

**Current Portfolio** is read via a plain `SELECT` against this user's own
open `trades` rows. **Deliberately does not call `ensureSeedTrades()`**
(unlike `routes/portfolio.ts`) — "No portfolio mutation" is taken
literally, so an account with no open positions is honestly shown as
empty rather than silently auto-seeded with demo trades.

**Hypothetical Post-Preview Portfolio** = current positions + one
synthetic entry reconstructed **entirely from already-public
`OrderPreviewTicket` fields** — never a second private call into
`execution.ts`, never persisted anywhere:

```
syntheticLeg.quantity = ticket.legs[i].ratioQty * ticket.quantity
```

`ratioQty` is the per-spread (1-lot) leg ratio; multiplying by the
ticket's own `quantity` (number of spreads) reproduces exactly the leg
quantities `execution.ts`'s own private `storedLegs` would have used —
proven identical by a dedicated test.

Both snapshots report, side by side:
- **Exposure by symbol** — `maxLoss` summed per symbol.
- **Long vs. short exposure** — the same net-credit-sign convention
  `tradeAnalytics.ts`'s `tradeDirection()` established on the frontend
  last sprint (credit ≥ 0 → "short" the spread; credit < 0 → "long"),
  reused here for backend aggregation.
- **Portfolio-level Greeks** — `serverState.ts`'s own `computeTradeGreeks()`
  (unmodified — the exact function `routes/portfolio.ts`'s Engine 3
  dashboard already uses), summed across every position in the snapshot.

**Estimated delta/theta/gamma/vega impact** = `hypothetical.greeks −
current.greeks`, honestly `null` when no valid preview exists.

**Exposure by sector is always honestly `{available: false, reason:
"No sector/industry classification is stored on options positions in
this engine."}`** — no sector data exists anywhere in this engine's own
data model, and reusing Engine 1's sector taxonomy would have introduced a
cross-engine dependency outside this sprint's explicit reuse scope. Never
fabricated.

---

## 6. Risk Warnings (8 categories)

| Code | Source |
|---|---|
| `oversized_position` | Reused, relabeled, from `execution.ts`'s own `validatePreTrade` "Max risk per trade" check. |
| `excess_concentration` | Reused, relabeled, from `execution.ts`'s own `validatePreTrade` "Total portfolio risk" check. |
| `buying_power_exhaustion` | New, disclosed, named threshold: `buyingPowerUtilizationPct > 90` (`BUYING_POWER_EXHAUSTION_THRESHOLD_PCT`). |
| `excess_leverage` | New, disclosed, named threshold: `notionalValue / accountValue > 3` (`MAX_LEVERAGE_RATIO`). |
| `position_conflict` | Reused, unmodified, from last sprint's Order Preview checklist. |
| `existing_order` | Reused, unmodified, from last sprint's Order Preview checklist. |
| `missing_broker_data` | New, honest disclosure: whenever no successful Broker Health check exists this session, current-portfolio figures are labeled as local-only. |
| `missing_credentials` | Reused, unmodified, from last sprint's Order Preview checklist. |

Since this page never submits an order, `status: "blocked"` here is
purely informational — it never actually prevents anything, because
nothing is ever sent.

---

## 7. Scenario Comparison

50%/75%/100% of the entered quantity (`Math.max(1, Math.round(base × pct))`),
plus an optional "Custom" scenario when `customQuantity` is supplied. Each
scenario is computed by an **independent call to the same reused
`buildOrderPreview()`**, varying only the quantity — genuinely re-derived
for each, never interpolated. When the base symbol/strategy is itself
invalid, the entire scenario list is honestly empty rather than computing
4 doomed previews against a known-bad input.

---

## 8. What this sprint did not change

- `execution.ts`, `optionsMath.ts`, `risk.ts` — zero-line diff.
- `lib/orderPreview.ts`/`routes/orderPreview.ts` — unmodified, called as-is.
- `routes/portfolio.ts` — unmodified; its own `ensureSeedTrades()`
  behavior was deliberately not adopted here.
- No database migration.
- No broker write operations of any kind.

---

## 9. Cross-references

- `docs/Alpaca-Paper-Trading-Architecture.md` §4.9 — the higher-level
  architectural summary of this same sprint.
- `docs/Order-Preview.md` — the prior sprint this one directly extends.
- `docs/Operations-Handbook.md` — day-to-day operational usage.
- CLAUDE.md rule 1 — `execution.ts` is never modified without explicit,
  specific approval; this sprint's own composition layer reuses it, never
  duplicates or bypasses its logic.
