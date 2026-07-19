# Decision Framework Methodology

**Phase 14 — Institutional Investment Decision Engine.** This document describes exactly how `lib/decisionEngine.ts` derives its recommendation, confidence, and 15-item checklist — and, critically, which pieces are direct reuse of an existing engine versus the one genuinely new formula this phase introduced.

All checklist statuses are one of `pass` / `warning` / `fail` / `unavailable`. A status is `unavailable` only when the underlying data genuinely cannot be resolved (no portfolio supplied, Management Quality's filing text unreachable, no valuation model produced a usable fair value) — never a fabricated middle value.

## 1. Recommendation — Buy / Accumulate / Hold / Reduce / Sell / Avoid

### 1.1 Synthesis Score (the one new composite)
A weighted average of already-computed 0-100 scores, renormalized over whichever are available — the same "combine already-scored composites" pattern Tom Nash Engine (Phase 2, Sprint 16) and Portfolio Intelligence (Phase 13) already establish:

| Input | Weight | Source |
|---|---|---|
| Tom Nash conviction score | 0.5 | `tomNash.convictionScore` (already a 5-pillar composite) |
| Investment Committee confidence | 0.2 | `investmentCommittee.confidenceScore` |
| Competitive Advantage score | 0.15 (if available) | `competitiveAdvantage.score` |
| Management Quality score | 0.15 (if available) | `managementQuality.score` |

### 1.2 Hard gates (checked before the synthesis score matters)
- `financialStrength.rating === "Risky"` → **Sell**, regardless of everything else — balance-sheet distress overrides.
- `financialStrength.rating === "Weak"` → **Avoid** — fails the quality-first filter, matching `analyzeValueDecision()`'s own precedent.

### 1.3 Verdict × Score table
| Investment Committee verdict | Synthesis score | Recommendation |
|---|---|---|
| Buy | ≥70 | **Buy** |
| Buy | 50–69 | **Accumulate** |
| Buy | <50 | Hold |
| Hold | <35 | **Reduce** |
| Hold | ≥35 | Hold |
| Wait | <35 | **Avoid** |
| Wait | 35–54 | **Reduce** |
| Wait | ≥55 | Hold |

### 1.4 Portfolio concentration downgrade
When a portfolio is supplied and this symbol's own current weight is already at or above `SINGLE_SYMBOL_CONCENTRATION_CAP_PCT` (25%, reused from `lib/investingRisk.ts`), a **Buy**/**Accumulate** outcome is downgraded to **Hold** — never add to an already-overconcentrated position.

## 2. Confidence
Reused directly from `investmentCommittee.confidenceScore` — no separate confidence formula. This already reflects the average confidence of the analysts that actually voted (Graham/Buffett/Tom Nash), honestly discounted when fewer models were available.

## 3. The 15-item Investment Checklist

| # | Item | Source | Status derivation |
|---|---|---|---|
| 1 | Business Quality | `businessQuality.score`/`.rating` | Pass ≥58, Warning ≥42, else Fail |
| 2 | Moat | `moat.rating` | Wide/Medium → Pass, Narrow → Warning, None → Fail |
| 3 | Management | `managementQuality.score` | Pass ≥65, Warning ≥45, else Fail; Unavailable if not resolvable |
| 4 | Capital Allocation | `tomNash.capitalAllocation.score` | Pass ≥65, Warning ≥45, else Fail |
| 5 | Revenue Growth | Investment Quality's "Revenue Growth" metric | Pass ≥65, Warning ≥45, else Fail |
| 6 | Margins | Average of Investment Quality's Gross/Operating/Net Margin metrics | Pass ≥65, Warning ≥45, else Fail |
| 7 | Cash Flow | Financial Strength's "FCF reliability" metric | Pass ≥65, Warning ≥45, else Fail |
| 8 | Debt | Financial Strength's "Leverage" metric | Pass ≥65, Warning ≥45, else Fail |
| 9 | ROIC | Investment Quality's "Return on Invested Capital" metric | Pass ≥65, Warning ≥45, else Fail |
| 10 | ROE | Investment Quality's "Return on Equity" metric | Pass ≥65, Warning ≥45, else Fail |
| 11 | Valuation | `classifyMarginOfSafety(consolidatedMoS.averageMarginOfSafety).rating` | Cheap/Fair → Pass, Expensive → Warning, Very Expensive → Fail |
| 12 | Margin of Safety | `classifyMarginOfSafety(...).marginOfSafetyLabel` | High/Medium → Pass, Low → Warning, None → Fail |
| 13 | Risk | Portfolio's own current overall risk score (Portfolio Intelligence) | Pass ≥65, Warning ≥45, else Fail; Unavailable without a portfolio |
| 14 | Portfolio Fit | This symbol's current weight vs. the single-symbol cap, and its sector's exposure vs. the sector cap | Fail if over the symbol cap, Warning if the sector is over cap, else Pass; Unavailable without a portfolio |
| 15 | Diversification | Portfolio's own current Diversification Score (Portfolio Intelligence) | Pass ≥70, Warning ≥45, else Fail; Unavailable without a portfolio |

Every item's `explanation` string cites the concrete number/label behind its status — no item is ever a bare label with no supporting detail.

## 4. Never-fabricate discipline, explicitly

- Items 13–15 (Risk, Portfolio Fit, Diversification) are honestly `unavailable` whenever no portfolio was supplied to the route (`?portfolioId=` omitted) — never approximated from a hypothetical allocation this module does not compute.
- Item 3 (Management) is honestly `unavailable` whenever Document Intelligence/EDGAR cannot resolve a filing for the symbol — reported with an explicit reason, never a fabricated score.
- Items 11–12 (Valuation, Margin of Safety) are honestly `unavailable` whenever no valuation model (blended/Graham/DCF/Buffett) produced a usable fair value — e.g. non-positive trailing earnings.

## Cross-references

- `docs/Institutional-Decision-Engine.md` — the full module overview, reuse audit, and integration points.
- `docs/Investment-Recommendations.md` — how Strengths/Weaknesses/Risks/Catalysts/Why Buy/Why Wait/Why Sell are derived from the same underlying evidence.
