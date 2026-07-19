# Ranking Methodology

**Phase 15 — Institutional Opportunity Discovery Engine.** This document describes exactly how `lib/opportunityDiscovery.ts` ranks opportunities and buckets them into the 10 named Opportunity Dashboard categories — and, critically, confirms that no new score was invented for this phase, per the explicit "Rank opportunities using existing deterministic outputs only. Never invent scores." requirement.

## 1. The ranking number: reused, not invented

`rankOpportunities()` sorts by `rankScore` descending (ties broken alphabetically by symbol for a stable, deterministic order). `rankScore` is not a new formula — it is the **Decision Engine's own already-computed synthesis score** (`decisionSynthesisScore()`, `lib/decisionEngine.ts`, Phase 14, exported this phase for reuse rather than duplicated), the same weighted composite of Tom Nash conviction (0.5), Investment Committee confidence (0.2), Competitive Advantage (0.15), and Management Quality (0.15, honestly excluded here — see below) that already powers the Decision Engine's own Buy/Accumulate/Hold/Reduce/Sell/Avoid recommendation.

**Management Quality is deliberately excluded from a scan's synthesis score** — it requires an EDGAR filing fetch per symbol, and running that for up to ~70 scanned symbols would be prohibitively expensive. The `decisionSynthesisScore()` function itself already renormalizes over whichever inputs are available, so omitting Management Quality here doesn't distort the formula — it's the same honest degradation path the function already supports for any company where Management Quality can't be resolved.

## 2. The rank explanation: deterministic, quotes real numbers

Every row carries a `rankExplanation` string built by `buildRankExplanation()` — a template that quotes the row's own already-computed `rankScore`, `decisionRecommendation`, `tomNashConvictionScore`, `investmentCommittee.consolidatedVerdict`, and consolidated margin of safety. No new judgment, no LLM call, no invented reasoning — every sentence is a restatement of a number already on the row.

## 3. The 10 Opportunity Buckets

Each bucket is a disclosed, deterministic threshold or set-membership rule over already-computed `OpportunityRow` fields — never a new score, never a price forecast.

| Category | Rule |
|---|---|
| Top Opportunities | Highest synthesis score among a Buy/Accumulate recommendation, top 10 |
| Undervalued Companies | Consolidated margin of safety ≥ 15% (Valuation rating Cheap), sorted by margin of safety descending |
| High Quality Companies | Investment Quality score ≥ 70, sorted by score descending |
| Wide Moat Companies | Moat rating = "Wide", sorted by moat score descending |
| Dividend Opportunities | Dividend yield ≥ 2%, sorted by yield descending |
| Growth Opportunities | 5-year revenue growth ≥ 15%, sorted by growth descending |
| Deep Value Opportunities | Consolidated margin of safety ≥ 30% **AND** Business Quality score ≥ 42 (the second condition is a deliberate value-trap guard — a business scoring below 42/100 on quality is excluded even if nominally "cheap," since a deep discount on a genuinely weak business is not the same signal as a deep discount on a merely out-of-favor one) |
| Turnaround Candidates | Business Quality rating "Weak" or "Average" but a positive margin of safety **and** Financial Strength not "Risky" — currently out of favor but not distressed. A heuristic research-starting-point bucket, explicitly not a prediction that a turnaround will occur |
| Watchlist Candidates | A Buy/Accumulate recommendation for a symbol not already on the calling user's own Watchlist (requires `watchlistAware: true`; without it, the bucket simply doesn't exclude anything — never a fabricated "not on watchlist" guess) |
| Portfolio Upgrade Candidates | A "Buy" recommendation for a symbol not already held in the selected portfolio, sorted by synthesis score descending. Honestly empty (never approximated) when no `portfolioId` was supplied |

## 4. Comparison View

`compareOpportunities()` is purely presentational — for a small, hand-picked set of symbols, it identifies which symbol has the best already-computed value per dimension (`Decision Engine Synthesis Score`, `Business Quality`, `Investment Quality`, `Margin of Safety`, `Tom Nash Conviction`, `Revenue Growth (5y)`, `ROIC`, `Dividend Yield` — higher is better; `Debt/Equity` — lower is better). No new comparison metric is computed; every dimension is a field already on `OpportunityRow`.

## 5. Never-fabricate discipline, explicitly

- A bucket with no matching rows is honestly empty — never padded with a "closest match" that fails the bucket's own stated rule.
- Every bucket's `rule` string is returned in the API response itself, not just documented here — so the UI (and this document) can never silently drift from what the code actually does.
- No bucket, filter, or rank number ever depends on a price forecast, a probability estimate, or an LLM call.

## Cross-references

- `docs/Opportunity-Discovery.md` — the full module overview, reuse audit, and integration points.
- `docs/Institutional-Screener.md` — the 17 filter dimensions applied before ranking/bucketing.
- `docs/Decision-Framework.md` — the full derivation of `decisionSynthesisScore()`/`deriveRecommendation()`, reused verbatim by this phase.
