# Portfolio Optimisation

**Phase 18 — Institutional Portfolio Optimisation Engine.** This document describes the Portfolio Optimisation Dashboard — a deterministic, evidence-based review of an existing portfolio's own holdings, surfacing Portfolio Health, Concentration Analysis, Diversification Analysis, Position Quality Ranking, Upgrade/Trim/Exit Candidates, Capital Allocation Suggestions, Replacement Opportunities, and Cash Deployment Suggestions.

**This is a pure integration and optimisation layer.** No new valuation model, no new scoring system, and no duplicated business logic were built this phase. Every figure is a direct reuse of Portfolio Intelligence (Phase 13), the Decision Engine (Phase 14), the Investment Committee, and Opportunity Discovery (Phase 15).

---

## 1. Audit — what already existed, reused unmodified

| Capability needed | Already existed as | Reuse plan |
|---|---|---|
| Portfolio Health | `buildPortfolioIntelligence()`'s `qualityScore`/`capitalAllocationScore`/`diversificationScore`/`risk.overall` | Passed through unmodified |
| Concentration Analysis | `intelligence.risk.concentration` + `SINGLE_SYMBOL_CONCENTRATION_CAP_PCT` (25%, `lib/investingRisk.ts`) | Passed through + reused cap constant |
| Diversification Analysis | `intelligence.allocation.bySector/byIndustry/growthValueMix/qualityMix/largestPositionPct/top10ExposurePct` | Passed through unmodified |
| Position Quality Ranking | `intelligence.holdings[]` existed but was unsorted (confirmed in `PortfolioConstruction.tsx`'s own "Quality" tab table) | Sorted by the Decision Engine's own `rankScore` |
| Upgrade/Trim/Exit Candidates | The Decision Engine's own `decisionRecommendation` (Buy/Accumulate/Hold/Reduce/Sell/Avoid, via `buildOpportunityRow()`) | Direct reuse: Sell/Avoid → Exit, Reduce (or a concentration-cap breach) → Trim, a mediocre Hold with a real better alternative → Upgrade |
| Replacement Opportunities | `bucketOpportunities()`'s existing `"portfolio-upgrade-candidates"` bucket logic (Buy-rated, not already held, ranked) | Reused directly, sector-filtered per weak holding |
| Cash Deployment Suggestions | The same reuse, unfiltered, gated by `intelligence.allocation.cashAllocationPct` | Reused directly |
| Comparison View | `GET /opportunity-discovery/compare?symbols=...` + `compareOpportunities()` (`bestBy` per dimension) | Called directly from the new page — zero new backend code |
| Decision Engine / Investment Committee recommendation on every candidate | `OpportunityRow.decisionRecommendation`/`.investmentCommitteeVerdict`/`.rankExplanation` | Already present on every row |
| Saved Reviews | Nothing structured existed (`investing_portfolio_notes` is generic free text with no symbol/action linkage) | New table, mirroring `investing_decision_snapshots`' own headline+jsonb precedent |

## 2. What this phase added

### 2.1 `lib/portfolioOptimisation.ts` — `buildPortfolioOptimisation()`
A pure, I/O-free composition function. Given an already-built `PortfolioIntelligenceAnalysis`, each distinct held symbol's own `OpportunityRow` (built once per symbol via the existing `buildOpportunityRow()`), and the wider Opportunity Discovery universe's own `OpportunityRow[]`, it produces:

- **Position Quality Ranking** — held positions sorted by the Decision Engine's own `rankScore`, descending.
- **Upgrade / Trim / Exit classification** — a threshold-based bucketing over already-computed values:
  - **Exit**: the Decision Engine already recommends Sell or Avoid.
  - **Trim**: the Decision Engine recommends Reduce, or the position's own weight (or its sector's weight) breaches the existing single-symbol (25%) or sector (40%) concentration caps.
  - **Upgrade**: the Decision Engine recommends Hold with a synthesis score below its own 65-point pass bar, *and* a real, meaningfully-better (+15 points) same-sector alternative exists in the wider universe.
  - **Core**: everything else.
- **Capital Allocation Suggestions** — deterministic arithmetic over already-known weights (e.g. "Exit and Trim candidates together represent X% of current portfolio weight").
- **Replacement Opportunities** — for each weak holding, the top same-sector, not-already-held, Buy-rated alternatives from the wider universe.
- **Cash Deployment Suggestions** — the same reuse, unfiltered, shown only when `cashAllocationPct >= 2%`.
- **Evidence** on every candidate/replacement: the metrics already computed by `buildOpportunityRow()`, the Decision Engine's own recommendation, the Investment Committee's own verdict, the already-written `rankExplanation` sentence, plus one new deterministic sentence each for portfolio impact, risk impact, and diversification impact.

### 2.2 `GET /portfolio-construction/portfolios/:id/optimisation`
A thin route wrapper: resolves the portfolio's holdings, calls `buildPortfolioIntelligence()` and `scanOpportunities()` (both unmodified) plus one `buildOpportunityRow()` per distinct held symbol, and hands the results to `buildPortfolioOptimisation()`.

### 2.3 Saved Reviews (`investing_optimisation_reviews`)
A new table, mirroring `investing_decision_snapshots`' headline-columns-plus-jsonb-blob pattern: `userId`, `portfolioId` (cascade delete), an optional `symbol`, an `action` (upgrade/trim/exit/replace/note), a free-text `note`, and an `evidence` snapshot captured at save time. `GET`/`POST /portfolio-construction/portfolios/:id/optimisation/reviews`.

## 3. Never predicts prices, never forecasts returns

Every sentence produced by `buildPortfolioOptimisation()` describes a weight, a score, a rating, or a verdict that already exists — confirmed by a dedicated unit test scanning the entire output for forecasting vocabulary ("price target," "expected return," "forecast," "predict").

## Cross-references

- `docs/Optimisation-Workflow.md` — the end-to-end user workflow this page supports.
- `docs/Portfolio-Review-Guide.md` — how to read and act on an optimisation review.
- `docs/Institutional-Decision-Engine.md`, `docs/Institutional-Investing-Engine.md` — the underlying engines this module composes.
