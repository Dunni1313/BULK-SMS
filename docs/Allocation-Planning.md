# Allocation Planning (Phase 41)

The Rebalancing Planner / Proposed Allocation Comparison half of the
Institutional Portfolio Rebalancing & Allocation Planning Engine — see
`docs/Rebalancing-Engine.md` for the full Allocation Dashboard and
`docs/Institutional-Rebalancing-Model.md` for the detailed design
record.

## What "allocation planning" means in this platform

Allocation planning is a **comparison exercise**, not an optimisation
exercise. The Rebalancing Planner never searches for, scores, or
suggests a better allocation than the one a user manually enters — it
takes a caller-supplied set of proposed target weights and honestly
reports how far the current allocation is from them, and how much
dollar capital would need to move to close that gap exactly. It never
searches for a "better" allocation, never ranks candidate allocations,
and never recommends a specific trade.

This is not a new engine. The entire Current/Target/Drift computation
is `lib/portfolioConstruction.ts`'s own `computePortfolioAllocation()`
(Phase 2 Sprint 28), called **twice** over the same resolved prices —
once against the portfolio's own stored target weights (the "current"
view), once against the caller-supplied proposed weights (the
"proposed" view) — via a newly-extracted `resolvePricesAndMeta()`
helper, so the two calls never make duplicate provider requests. Phase
41 adds exactly one new layer: a row-by-row comparison between the two
views, plus the capital-movement arithmetic.

## The Proposed Allocation Comparison

`buildProposedAllocationComparison()` (`lib/rebalancingEngine.ts`)
takes a portfolio's holdings, already-resolved prices/metadata, and a
caller-supplied `ProposedTargetInput[]` (symbol + target weight). For
any holding not named in the proposal, its own already-stored target
weight is used unchanged — a proposal is a partial override, never a
requirement to re-specify every holding.

For each holding, the comparison row reports:

| Field | Meaning |
|---|---|
| `currentWeightPct` | The holding's real, market-value-weighted current percentage of the portfolio |
| `storedTargetWeightPct` | The holding's own already-stored target weight |
| `proposedTargetWeightPct` | The weight from the caller's proposal, or the stored target when not overridden |
| `driftFromProposedPct` | `currentWeightPct - proposedTargetWeightPct` — honestly `null` when the current weight itself can't be resolved |
| `rebalanceActionVsProposed` | `buy`/`sell`/`hold`/`unknown`, from `computePortfolioAllocation()`'s own already-tested drift-threshold classification, unmodified |
| `capitalMovementDollars` | See below |

## Capital movement required — the one genuinely new formula

The only new arithmetic this phase introduces:

```
capitalMovementDollars = -(driftFromProposedPct / 100) * totalMarketValue
```

A positive value means capital would need to move **in** to that
holding to reach the proposed target; a negative value means capital
would need to move **out**. This is a plain unit conversion of
already-computed weight-drift and market-value figures — **never a
suggested trade, never a share count, never an order**. The comparison
never calls any execution-adjacent code, never resolves a broker
account, and never writes to any trade or order table.

Totals roll up two headline figures:

- **Total capital to deploy** — the sum of every positive
  `capitalMovementDollars` across the portfolio.
- **Total capital to raise** — the sum of the absolute value of every
  negative `capitalMovementDollars`.

Both are honestly `0` (not `null`) when every holding is already at
its proposed target, and the comparison's own deterministic summary
sentence states the real count of holdings that would drift beyond the
platform's own established drift threshold
(`REBALANCE_DRIFT_THRESHOLD_PCT`, reused unchanged from Portfolio
Construction, Phase 2 Sprint 28) — never a fabricated number.

## The interactive Rebalancing Planner (frontend)

`RebalancingEngine.tsx`'s Rebalancing Planner tab lets a user select
one of their own Investing portfolios, edit each holding's proposed
target weight in a plain number input (pre-filled with the stored
target), and click "Compare Proposed Allocation." This calls
`POST /rebalancing/portfolios/:id/propose` with the edited targets and
renders the resulting comparison — current vs. proposed weight, drift,
capital movement, and rebalance action per holding, plus the two
capital totals. Nothing is persisted; a fresh comparison is computed
on every click, and reloading the page discards any unsaved edits.

## The Rebalancing Planning Report

`GET /reporting/rebalancing-planning-report/:portfolioId`
(`buildRebalancingPlanningReport()` in `lib/institutionalReporting.ts`)
reformats a Proposed Allocation Comparison into the standard
`InstitutionalReport` shape:

1. **Executive Summary** — the deterministic summary sentence, plus
   current/proposed market value.
2. **Proposed Allocation Comparison** — every holding's own current →
   proposed weight, drift, and rebalance action.
3. **Capital Movement Required** — the two capital totals, plus every
   nonzero per-holding dollar figure.

Since the generic Reporting Centre flow (`GET /reporting/*`, no
request body) carries no caller-specific proposal, this report
defaults its "proposed" comparison to the portfolio's own already-
stored target weights — an honest, disclosed degenerate case (current
drift shown as the "proposed" comparison), not a fabricated proposal.
A user who wants to report on a genuinely custom "what if" proposal
uses the interactive Rebalancing Planner (`POST /rebalancing/portfolios/:id/propose`)
directly.

## What was deliberately NOT built

- No optimisation search of any kind — the Planner only ever evaluates
  the exact proposal a user typed in, never a "best" or "nearby"
  alternative.
- No suggested trade, no share count, no order — every capital-movement
  figure is a dollar amount describing a gap, never an instruction to
  act on it.
- No persistence of a proposed allocation — every comparison is
  computed fresh and discarded once the response is rendered.
- No automatic rebalancing or auto execution of any kind — the Planner
  never calls `execution.ts` or any broker-adjacent code.

## Protected areas — confirmed unchanged

`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
`autoAdjustment.ts`, and every broker-integration file were not
modified. `lib/portfolioConstruction.ts`'s own
`computePortfolioAllocation()`/`buildPortfolioAllocation()` behavior is
byte-identical to before this phase — the only change to that file is
the additive extraction of `resolvePricesAndMeta()`, confirmed
behavior-preserving.
