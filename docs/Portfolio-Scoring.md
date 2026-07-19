# Portfolio Scoring Methodology

**Phase 13 — Institutional Portfolio Manager.** This document describes every score `lib/portfolioIntelligence.ts` produces at the portfolio level, and — critically — which ones are direct reuse of an existing, already-tested engine versus genuinely new formulas built this phase.

All scores are 0–100 unless stated otherwise. A score is `null` only when there is genuinely insufficient data to compute it — never a fabricated 0 or 100.

## 1. Portfolio Quality Score

**Reused, not new.** A market-value-weighted average of each distinct holding's own `investmentQuality.score` (`lib/investmentQuality.ts`, unchanged since Phase 2 Sprint 15) — the exact 12-metric Business Quality composite Engine 1's Value Research report already computes per company. Renormalized over only the holdings that could be scored (an unresolvable symbol is excluded, not averaged in as 0).

## 2. Portfolio Capital Allocation Score

**Reused, not new.** A market-value-weighted average of each holding's own Tom Nash "Capital Allocation" pillar score (`lib/tomNashEngine.ts`, unchanged since Phase 2 Sprint 16/24) — itself already a composite of Cash Position, Debt Levels, ROIC, Share Dilution/Buybacks, and Insider Ownership.

## 3. Diversification Score — the one genuinely new composite

A Herfindahl-Hirschman Index (HHI) over each priced holding's share of total market value: `score = (1 - HHI) × 100`, so a single 100%-weight holding scores 0 and an evenly-spread N-holding portfolio approaches `100 × (1 - 1/N)`. The detail sentence also names how many distinct sectors are represented (informational only — the score itself is HHI-only, a well-established concentration measure, not a second, competing formula).

## 4. Allocation breakdowns (not scores — slices of a portfolio's own composition)

- **By Sector / By Industry / By Market Cap Band** — grouped directly from each holding's already-resolved `sector`/`industry`/`marketCap` (the same `Fundamentals` resolution `buildPortfolioAllocation()` already performs — zero new provider calls). Market Cap bands: Mega (≥$200B) / Large (≥$10B) / Mid (≥$2B) / Small (≥$300M) / Micro.
- **Growth vs. Value Mix** — a disclosed heuristic reusing two already-computed signals, never a new judgment: a holding is "Growth" when its Tom Nash Growth pillar score is ≥65; "Value" when growth is <55 **and** the blended valuation model's rating is Cheap or Fair; otherwise "Blend."
- **Quality Mix** — buckets each holding's own `investmentQuality.score` into High (≥75) / Medium (≥45) / Low.
- **Country / Currency exposure** — always honestly `available: false`. No provider integrated in this codebase (SIMULATED or LIVE) reports a holding's country of domicile/listing or reporting/trading currency. Never approximated from sector/industry.

## 5. Weighted fundamental metrics

Market-value-weighted averages of each holding's own already-computed `Fundamentals` fields — ROIC, ROE, Gross Margin, Operating Margin, FCF Yield, Dividend Yield, Debt-to-Equity. Zero new formulas; these are the exact numbers every Value Research report already shows per company, just weight-averaged across a portfolio.

## 6. Income / Performance (not scores — real figures)

- **Portfolio Dividend Yield / Est. Annual Dividend Income** — the weighted dividend yield above, plus `Σ(shares × dividendPerShare)` across holdings with both fields present.
- **Performance (cost basis / unrealized P&L)** — honestly computed only for holdings with both `shares` and the new `avgCostBasis` field entered; `costBasisValue = shares × avgCostBasis`, `unrealizedPnl = marketValue - costBasisValue`. Never approximated for a holding missing either input — that holding is named explicitly in `holdingsWithoutCostBasis`.

## 7. Position Sizing / Rebalancing Assistant

For a holding with a known drift, current price, and total portfolio market value: `suggestedShareDelta = (targetWeightPct / 100 × totalMarketValue / currentPrice) - currentShares`. A concrete, disclosed number derived directly from figures `buildPortfolioAllocation()` (unmodified) already computes — never a trade recommendation, never submitted, scheduled, or previewed as an order.

## Cross-references

- `docs/Institutional-Portfolio-Manager.md` — the full module overview.
- `docs/Portfolio-Risk-Framework.md` — the risk-side scoring (Concentration, Sector Exposure, Cyclicality, and the 5 new extended dimensions).
- `docs/Business-Quality-Scoring.md` — the underlying Investment Quality / Business Quality methodology this module reuses per holding.
