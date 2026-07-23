# Institutional Rebalancing Model — Design & Audit Record (Phase 41)

The exact design decisions behind `lib/rebalancingEngine.ts`, kept as a
permanent record for future phases, mirroring the role
`docs/Institutional-Decision-Model.md` plays for Phase 40,
`docs/Institutional-Scenario-Model.md` plays for Phase 39,
`docs/Institutional-Performance-Model.md` plays for Phase 38, and
`docs/Institutional-Risk-Model.md` plays for Phase 37.

## Guiding constraint

The Phase 41 kickoff was explicit: **this phase is planning and
analysis only.** Do NOT implement trade recommendations, buy/sell
signals, automatic portfolio optimisation, automatic rebalancing, auto
execution, AI predictions, forecasting, machine learning, or broker
integration changes. Every figure below was designed against that
constraint first — every value is either (a) reused verbatim from an
existing, already-computed engine output, or (b) plain deterministic
arithmetic over those already-computed figures.

## Audit performed before implementation

Before writing any code, the following components were investigated
via direct source reads, per the kickoff's own required audit:

### INVESTING

| Component | Investigated for | Verdict |
|---|---|---|
| Portfolio Dashboard (`lib/portfolioDashboard.ts`, Options-side) | Health-scoring shape | Not applicable — this is the Options Income Engine's own dashboard, not an Investing allocation surface |
| Portfolio Optimizer (`lib/portfolioOptimisation.ts`) | Reusable Current-vs-Target concept | **Not reusable.** A quality-based Upgrade/Trim/Exit/Core classifier driven by the Decision Engine's own Buy/Hold/Sell recommendations — an entirely different concept from weight comparison; shares no reusable core logic |
| Risk & Exposure Engine (`lib/riskExposureEngine.ts`, Phase 37) | Cross-engine Capital/Sector/Strategy/Asset Allocation | **Reused directly** — `buildRiskExposureDashboard()`'s own `combined.*` fields supply every cross-engine figure this phase needs |
| Performance Engine (`lib/performanceAttribution.ts`, Phase 38) | Allocation-adjacent figures | Investigated; performance attribution is P&L-oriented, not allocation-oriented — not applicable to this phase's scope |
| Scenario Engine (`lib/scenarioEngine.ts`, Phase 39) | Allocation-adjacent figures | Investigated; scenario impact is hypothetical-shock-oriented, not allocation-oriented — not applicable to this phase's scope |
| Decision Support Engine (`lib/decisionSupportEngine.ts`, Phase 40) | Precedent for composition-layer design | **Reused as the structural template** — same "pure composition, zero new scoring formulas" discipline |

### TRADING

| Component | Investigated for | Verdict |
|---|---|---|
| Trading Analytics (`lib/tradingAnalytics.ts`) | A target-weight or allocation concept | Investigated; Trading positions carry `entryPrice`/`stopPrice`/`targetPrice`, no target-weight field of any kind |
| Risk Engine (`lib/tradingRisk.ts`) | Capital/buying-power figures | **Reused directly** via `riskExposureEngine.ts`'s own already-computed Trading risk summary |
| Performance Engine | Allocation-adjacent figures | Not applicable, per Investing's own finding above |

### OPTIONS

| Component | Investigated for | Verdict |
|---|---|---|
| Options Income Engine / Portfolio Dashboard | A target-weight or allocation concept | Investigated; Options trades carry strike/expiration/strategy data, no target-weight field of any kind |
| Options Lifecycle | Allocation-adjacent figures | Not applicable — lifecycle tracking is position-state-oriented, not allocation-oriented |
| Portfolio Exposure / Greeks / Income Analytics | Cross-engine Capital/Buying-Power figures | **Reused directly** via `riskExposureEngine.ts`'s own already-computed Options risk summary |

### SHARED

| Component | Investigated for | Verdict |
|---|---|---|
| Executive Dashboard / Executive Intelligence / Cross-Engine Workspace | Integration surfaces | **Extended** — one new deep link each, mirroring the exact pattern Phase 40's own Decision Support Engine link established |
| Reporting Centre (`lib/institutionalReporting.ts`) | Report-generation framework | **Reused directly** — the existing `ReportSection`/`InstitutionalReport` shape, `REPORT_TYPE_META` array, and `regenerate()` dispatcher, extended with 2 new entries each |
| Learning Centre (`lib/learningPaths.ts`) | Existing topic content | **Reused directly** — every Rebalancing Learning link resolves a real, already-existing topic key, verified to exist before use |
| Institutional AI Coach (`lib/coach.ts`) | The shared disclaimer contract | **Reused directly** — `COACH_DISCLAIMER`, imported unmodified |
| Navigation / Command Palette (`lib/nav-items.ts`) | The single navigation index | **Extended** — one new `NavItem`; the Command Palette and sidebar both read this same array, so no second wiring point was needed |

**Genuine gap found, and how it was resolved:** no existing module in
this codebase computes a Current-vs-Target allocation comparison for a
whole portfolio and exposes it as its own dashboard — `computePortfolioAllocation()`
(Phase 2 Sprint 28) already does the per-portfolio math, but only as an
internal helper for Portfolio Construction's own single-portfolio page,
never assembled across all of a user's portfolios, never paired with
cross-engine Sector/Asset/Strategy/Capital Allocation, and with no
"propose a different target and compare" capability at all. New
`lib/rebalancingEngine.ts` is the pure composition + one genuinely new
arithmetic layer that fills this gap.

## What is genuinely new vs. reused, at a glance

`lib/rebalancingEngine.ts` introduces exactly **one genuinely new
formula**:

1. **Capital movement required** —
   `-(driftFromProposedPct / 100) * totalMarketValue`, a plain unit
   conversion of already-computed weight-drift and market-value figures
   into a dollar amount. Never a suggested trade, never a share count,
   never an order. See `docs/Allocation-Planning.md` for the full
   derivation.

Everything else is either a direct re-export of an already-computed
figure (`computePortfolioAllocation()`'s own holdings/drift/rebalance-
action fields, `buildRiskExposureDashboard()`'s own `combined.*`
fields) or a thin, honest pass-through wrapper (the per-portfolio
summary loop, the target-allocation-availability disclosure).

One small, disclosed, behavior-preserving **refactor** was also made to
enable reuse without duplicating provider calls: `resolvePricesAndMeta()`
was extracted out of `lib/portfolioConstruction.ts`'s own
`buildPortfolioAllocation()`, which now simply calls the new helper and
then the existing, unmodified `computePortfolioAllocation()`. This lets
the Rebalancing Planner resolve prices/metadata **once** and call
`computePortfolioAllocation()` **twice** (current vs. proposed) over
the same resolved data — `buildPortfolioAllocation()`'s own signature
and output are confirmed byte-identical before and after this
extraction.

## Never blended across engines

Every cross-engine section in `RebalancingDashboard` deliberately keeps
Investing/Trading/Options figures **side by side**, never summed into
one blended total — the same discipline every prior cross-engine
dashboard in this project (Phases 37–40) already established:

- Capital Allocation shows Investing/Trading/Options figures as
  separate entries, reused verbatim from `combined.capitalAllocation`
  — never a fabricated "total capital" figure.
- Target Allocation Availability is reported **per engine**, honestly:
  Investing has a real, stored target-weight concept; Trading and
  Options do not, and this is stated as a disclosed fact with its own
  reason string, never silently omitted or approximated with a
  fabricated default (e.g., an equal-weight assumption).

## The Rebalancing Planner's honesty guarantees

- A holding's `capitalMovementDollars` is `null`, not `0`, whenever the
  underlying drift can't be computed (an unresolvable price) — the same
  honest-null-over-fabricated-zero discipline `computePortfolioAllocation()`
  itself already established for `actualWeightPct`/`driftPct`.
- `totalCapitalToDeployDollars`/`totalCapitalToRaiseDollars` sum only
  over rows with a genuine, computed movement — never inflated by
  treating a `null` movement as `0` in the sum (the sum itself defaults
  a missing row's contribution to `0` for the *aggregate*, but each
  individual row's own `capitalMovementDollars` stays honestly `null`).
- The proposed-target substitution never silently drops a holding —
  every holding in the portfolio appears in the comparison's `rows`,
  whether or not its target was overridden by the proposal.
- No proposal is ever persisted. `POST /rebalancing/portfolios/:id/propose`
  computes and returns a comparison; nothing is written to
  `investing_holdings` or any other table.

## What was deliberately NOT built

- **No trade recommendations, buy/sell signals, or suggested trades.**
  Every `rebalanceAction`/`rebalanceActionVsProposed` field is a
  descriptive classification of a real, already-computed drift (from
  Phase 2 Sprint 28's own unmodified logic) — it describes what *is*,
  never what to *do*.
- **No automatic portfolio optimisation.** The Planner never searches
  for a "better" allocation; it only evaluates the exact proposal a
  user manually entered.
- **No automatic rebalancing or auto execution.** This phase reads,
  compares, and presents — it never writes to a trade, position, or
  order, and never calls any execution-adjacent code.
- **No AI predictions, forecasting, or machine learning.** Every figure
  is either a direct reuse of an already-computed value or plain
  deterministic arithmetic — no statistical model, no trained model, no
  probability distribution.
- **No new database table.** This phase is entirely a read layer (plus
  one on-demand comparison endpoint) over the outputs of
  `computePortfolioAllocation()` and `buildRiskExposureDashboard()`,
  computed fresh on every request — nothing is persisted.

## Protected areas — confirmed unchanged

`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
`autoAdjustment.ts`, and every broker-integration file were not
modified by any file in this phase. `lib/riskExposureEngine.ts` was
also not modified — reused verbatim. `lib/portfolioConstruction.ts`'s
own `computePortfolioAllocation()`/`buildPortfolioAllocation()` behavior
is confirmed byte-identical before and after this phase's one
additive, behavior-preserving extraction (`resolvePricesAndMeta()`).
