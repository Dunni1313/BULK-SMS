# Institutional Screener — Filter Reference

**Phase 15 — Institutional Opportunity Discovery Engine.** This document describes exactly how each of the 17 requested Screener filter dimensions is implemented — and, critically, which are direct reuse of an already-computed field versus honestly unavailable.

All filtering is pure, deterministic set-membership/threshold logic in `applyScreenerFilters()` (`lib/opportunityDiscovery.ts`) over an `OpportunityRow`'s already-computed fields. No filter recomputes or re-derives a number — every one reads a field already produced by an existing engine.

## 1. The 17 filter dimensions

| # | Filter | Field(s) read | Source engine |
|---|---|---|---|
| 1 | Country | — | **Always honestly unavailable.** No provider (SIMULATED or LIVE) supplies a country/currency field anywhere in `Fundamentals`. Accepted as a request parameter (so the API shape matches the specification), but never applied to any row — its presence always adds `"country"` to the response's `unavailableFilters`, never silently ignored, never approximated. |
| 2 | Sector | `sector` | `Fundamentals.sector` (Phase 2, Sprint 20) |
| 3 | Industry | `industry` | `Fundamentals.industry` (Phase 2, Sprint 20) |
| 4 | Market Cap | `marketCap` | `Fundamentals.marketCap` (Phase 2, Sprint 29) |
| 5 | Revenue Growth | `revenueGrowth5y` | `Fundamentals.revenueGrowth5y` |
| 6 | ROIC | `roic` | `Fundamentals.roic` |
| 7 | ROE | `roe` | `Fundamentals.roe` |
| 8 | Debt | `debtToEquity` | `Fundamentals.debtToEquity` |
| 9 | Free Cash Flow | `fcfMargin` | `Fundamentals.fcfMargin` — a per-share-independent margin, not an absolute dollar figure (an absolute FCF figure requires `getFinancialStatements()`'s heavier, per-symbol, on-demand fetch — out of scope for a bulk scan, per the established on-demand-for-heavier-operations discipline) |
| 10 | Margins | — | Not a single filter dimension in the row shape; Gross/Operating/Net Margin are all already visible per-row via the existing Financial Ratios section on the full report (one click away via "Analyse") |
| 11 | Dividend Yield | `dividendYield` | `Fundamentals.dividendYield` |
| 12 | Valuation | `valuationRating` | `report.valuation.rating` (Blended model) — Cheap/Fair/Expensive/Very Expensive/Unavailable |
| 13 | Margin of Safety | `marginOfSafety` | `report.consolidatedMarginOfSafety.averageMarginOfSafety` (Blended+Graham+DCF+Buffett average, Phase 14) |
| 14 | Business Quality | `businessQualityScore` | `report.businessQuality.score` |
| 15 | Investment Committee Rating | `investmentCommitteeVerdict` | `report.investmentCommittee.consolidatedVerdict` (Buy/Hold/Wait) |
| 16 | Decision Engine Recommendation | `decisionRecommendation` | `deriveRecommendation()` (Phase 14, `lib/decisionEngine.ts`, reused directly) |
| 17 | Tom Nash Score | `tomNashConvictionScore` | `report.tomNash.convictionScore` |

## 2. Never-fabricate discipline, explicitly

- **Country** is the one dimension with no honest way to compute it — reported unavailable, never guessed from a company name or synthetic sector bucket.
- A filter with no matching rows returns an honestly empty result — never a fabricated "closest match."
- `totalBeforeFilter` always reflects the pre-filter row count, so a user can see how aggressive their own filter combination was, never silently hidden.

## 3. Request/response shape

`POST /opportunity-discovery/scan` accepts an optional `filters: OpportunityScreenerFilters` object (all fields optional — an absent filter is simply not applied) alongside `symbols`, `forceRefresh`, `watchlistAware`, and `portfolioId`. The response's `unavailableFilters: string[]` and `totalBeforeFilter: number` fields make the screener's own honesty verifiable by the caller, not just asserted in prose.

## Cross-references

- `docs/Opportunity-Discovery.md` — the full module overview, reuse audit, and integration points.
- `docs/Ranking-Methodology.md` — how the filtered rows are then ranked and bucketed.
